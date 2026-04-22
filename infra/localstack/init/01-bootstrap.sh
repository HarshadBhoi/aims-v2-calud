#!/bin/bash
# AIMS v2 — LocalStack bootstrap
#
# Runs once when LocalStack is ready (via /etc/localstack/init/ready.d hook).
# Provisions KMS keys, SQS queues, S3 buckets for local dev.
#
# See ADR-0001 (ALE/KMS), ADR-0004 (SQS for workers).

set -euo pipefail

echo "[aims-bootstrap] Initializing AWS resources in LocalStack..."

REGION="${AWS_DEFAULT_REGION:-us-east-1}"

# ─── KMS ─────────────────────────────────────────────────────────────────────
# Master KEK wraps per-tenant DEKs. In real AWS this is a CMK in the tenant's
# region. In dev, one shared key is fine.

echo "[aims-bootstrap] Creating KMS master key..."
MASTER_KEY_ID=$(awslocal kms create-key \
  --region "$REGION" \
  --description "AIMS v2 dev master KEK" \
  --key-usage ENCRYPT_DECRYPT \
  --origin AWS_KMS \
  --query 'KeyMetadata.KeyId' \
  --output text)

awslocal kms create-alias \
  --region "$REGION" \
  --alias-name alias/aims-dev-master \
  --target-key-id "$MASTER_KEY_ID"

echo "[aims-bootstrap] Master key: $MASTER_KEY_ID (alias: alias/aims-dev-master)"

# ─── SQS ─────────────────────────────────────────────────────────────────────
# Outbox: transactional event dispatch (ADR-0004).
# Pdf-render: long-running rendering jobs off the hot path.
# Each pair has a DLQ.

echo "[aims-bootstrap] Creating SQS queues..."

create_queue() {
  local name="$1"
  awslocal sqs create-queue \
    --region "$REGION" \
    --queue-name "$name" \
    > /dev/null
  echo "  [queue] $name"
}

create_queue aims-events-outbox-dlq
create_queue aims-events-outbox
create_queue aims-pdf-render-dlq
create_queue aims-pdf-render

# Wire DLQs as redrive targets (simple 3-attempt policy for dev).
OUTBOX_DLQ_ARN=$(awslocal sqs get-queue-attributes \
  --region "$REGION" \
  --queue-url "http://localhost:4566/000000000000/aims-events-outbox-dlq" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' --output text)

PDF_DLQ_ARN=$(awslocal sqs get-queue-attributes \
  --region "$REGION" \
  --queue-url "http://localhost:4566/000000000000/aims-pdf-render-dlq" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' --output text)

awslocal sqs set-queue-attributes \
  --region "$REGION" \
  --queue-url "http://localhost:4566/000000000000/aims-events-outbox" \
  --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$OUTBOX_DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}" \
  > /dev/null

awslocal sqs set-queue-attributes \
  --region "$REGION" \
  --queue-url "http://localhost:4566/000000000000/aims-pdf-render" \
  --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$PDF_DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}" \
  > /dev/null

# ─── S3 ──────────────────────────────────────────────────────────────────────

echo "[aims-bootstrap] Creating S3 buckets..."

create_bucket() {
  local name="$1"
  awslocal s3api create-bucket \
    --region "$REGION" \
    --bucket "$name" \
    > /dev/null
  echo "  [bucket] $name"
}

create_bucket aims-dev-evidence       # PBC uploads, WP attachments
create_bucket aims-dev-reports        # Rendered PDFs
create_bucket aims-dev-audit-logs     # Archived audit-log partitions

echo "[aims-bootstrap] Done."
