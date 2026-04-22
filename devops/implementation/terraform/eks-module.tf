############################################################################
# REFERENCE IMPLEMENTATION — Terraform EKS module (composed example)
#
# Illustrative composition of an EKS cluster for AIMS v2. Real tree would
# split into:
#   modules/eks/{main,variables,outputs,cluster,nodegroups,addons}.tf
#   environments/production/us-east-1/main.tf  (calls the module)
#
# This single file shows the composition end-to-end for review.
############################################################################

terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.60" }
    helm = { source = "hashicorp/helm", version = "~> 2.13" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.30" }
  }
  backend "s3" {
    bucket         = "aims-v2-tf-state-production"
    key            = "platform/us-east-1/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    kms_key_id     = "alias/aims-tf-state"
    dynamodb_table = "aims-v2-tf-locks"
  }
}

############################################################################
# Variables
############################################################################

variable "env"    { type = string }    # "production"
variable "region" { type = string }    # "us-east-1"
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }   # from network module
variable "cluster_version" { type = string, default = "1.30" }

locals {
  cluster_name = "eks-${var.env}-${var.region}"
  common_tags = {
    Environment  = var.env
    Service      = "platform"
    ManagedBy    = "terraform"
    Owner        = "platform-team"
    CostCenter   = "engineering"
    Compliance   = "soc2"
  }
}

############################################################################
# KMS key for secrets envelope encryption in cluster
############################################################################

resource "aws_kms_key" "cluster" {
  description             = "EKS secrets encryption for ${local.cluster_name}"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = var.env == "production"
  tags                    = local.common_tags
}

resource "aws_kms_alias" "cluster" {
  name          = "alias/eks-${var.env}-${var.region}"
  target_key_id = aws_kms_key.cluster.key_id
}

############################################################################
# EKS Cluster
############################################################################

resource "aws_eks_cluster" "main" {
  name     = local.cluster_name
  role_arn = aws_iam_role.cluster.arn
  version  = var.cluster_version

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs     = var.env == "production" ? ["0.0.0.0/0"] : ["10.0.0.0/8"]
  }

  encryption_config {
    provider { key_arn = aws_kms_key.cluster.arn }
    resources = ["secrets"]
  }

  enabled_cluster_log_types = [
    "api", "audit", "authenticator", "controllerManager", "scheduler"
  ]

  access_config {
    authentication_mode                         = "API_AND_CONFIG_MAP"
    bootstrap_cluster_creator_admin_permissions = false
  }

  tags = merge(local.common_tags, { Name = local.cluster_name })

  depends_on = [
    aws_iam_role_policy_attachment.cluster_amazoneks,
    aws_cloudwatch_log_group.cluster,
  ]
}

resource "aws_cloudwatch_log_group" "cluster" {
  name              = "/aws/eks/${local.cluster_name}/cluster"
  retention_in_days = 90
  kms_key_id        = aws_kms_key.cluster.arn
  tags              = local.common_tags
}

############################################################################
# IAM role for cluster
############################################################################

resource "aws_iam_role" "cluster" {
  name = "${local.cluster_name}-cluster"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "cluster_amazoneks" {
  role       = aws_iam_role.cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

############################################################################
# OIDC provider for IRSA (IAM Roles for Service Accounts)
############################################################################

data "tls_certificate" "cluster" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "cluster" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.cluster.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
  tags            = local.common_tags
}

############################################################################
# Node Groups
#
# `system`   — core addons (coredns, ingress, observability)
# `app`      — web + api pods
# `worker`   — BullMQ workers (CPU-intensive: PDF, imports)
############################################################################

locals {
  node_groups = {
    system = {
      instance_types = ["m6i.large"]
      min_size       = 3
      desired_size   = 3
      max_size       = 6
      labels         = { role = "system" }
      taints         = [] # no taint — everything schedulable here as fallback
    }
    app = {
      instance_types = ["m6i.xlarge", "m6a.xlarge"]   # multi-type for spot mix later
      min_size       = var.env == "production" ? 3 : 2
      desired_size   = var.env == "production" ? 6 : 2
      max_size       = 24
      labels         = { role = "app" }
      taints         = []
    }
    worker = {
      instance_types = ["c6i.xlarge"]
      min_size       = 2
      desired_size   = 2
      max_size       = 12
      labels         = { role = "worker" }
      taints = [{
        key = "workload", value = "worker", effect = "NO_SCHEDULE"
      }]
    }
  }
}

resource "aws_iam_role" "node" {
  for_each = local.node_groups
  name     = "${local.cluster_name}-node-${each.key}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = merge(local.common_tags, { NodeGroup = each.key })
}

resource "aws_iam_role_policy_attachment" "node_worker_policy" {
  for_each   = local.node_groups
  role       = aws_iam_role.node[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}
resource "aws_iam_role_policy_attachment" "node_cni_policy" {
  for_each   = local.node_groups
  role       = aws_iam_role.node[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}
resource "aws_iam_role_policy_attachment" "node_ecr_policy" {
  for_each   = local.node_groups
  role       = aws_iam_role.node[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}
resource "aws_iam_role_policy_attachment" "node_ssm_policy" {
  for_each   = local.node_groups
  role       = aws_iam_role.node[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_eks_node_group" "main" {
  for_each        = local.node_groups
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = each.key
  node_role_arn   = aws_iam_role.node[each.key].arn
  subnet_ids      = var.private_subnet_ids
  instance_types  = each.value.instance_types

  # Bottlerocket for minimal attack surface.
  ami_type = "BOTTLEROCKET_x86_64"

  scaling_config {
    min_size     = each.value.min_size
    desired_size = each.value.desired_size
    max_size     = each.value.max_size
  }

  update_config {
    max_unavailable_percentage = 33
  }

  labels = each.value.labels

  dynamic "taint" {
    for_each = each.value.taints
    content {
      key    = taint.value.key
      value  = taint.value.value
      effect = taint.value.effect
    }
  }

  # Encryption on EBS root volume.
  disk_size = 50
  # Note: actual EBS encryption enforced by region-level default + SCP.

  tags = merge(local.common_tags, {
    Name      = "${local.cluster_name}-${each.key}"
    NodeGroup = each.key
  })

  # Allow k8s to remove finalizers on delete (avoid stuck deletions).
  lifecycle { create_before_destroy = true }
}

############################################################################
# Managed addons
############################################################################

resource "aws_eks_addon" "vpc_cni" {
  cluster_name  = aws_eks_cluster.main.name
  addon_name    = "vpc-cni"
  addon_version = "v1.18.3-eksbuild.1"
  resolve_conflicts_on_update = "OVERWRITE"
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "kube-proxy"
}

resource "aws_eks_addon" "coredns" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "coredns"
  depends_on   = [aws_eks_node_group.main]
}

resource "aws_eks_addon" "ebs_csi" {
  cluster_name             = aws_eks_cluster.main.name
  addon_name               = "aws-ebs-csi-driver"
  service_account_role_arn = aws_iam_role.ebs_csi_irsa.arn
}

# IRSA for the EBS CSI driver.
resource "aws_iam_role" "ebs_csi_irsa" {
  name = "${local.cluster_name}-ebs-csi"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.cluster.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${replace(aws_iam_openid_connect_provider.cluster.url, "https://", "")}:sub" = "system:serviceaccount:kube-system:ebs-csi-controller-sa"
          "${replace(aws_iam_openid_connect_provider.cluster.url, "https://", "")}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
  tags = local.common_tags
}
resource "aws_iam_role_policy_attachment" "ebs_csi" {
  role       = aws_iam_role.ebs_csi_irsa.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/Amazon_EBS_CSI_DriverPolicy"
}

############################################################################
# Helm releases for cluster-wide operators
# (external-secrets, cert-manager, aws-load-balancer-controller, kyverno,
# argocd, argo-rollouts)
#
# Shown inline for one example; rest follow same pattern in module tree.
############################################################################

resource "helm_release" "external_secrets" {
  name             = "external-secrets"
  repository       = "https://charts.external-secrets.io"
  chart            = "external-secrets"
  version          = "0.10.x"
  namespace        = "external-secrets"
  create_namespace = true

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = aws_iam_role.external_secrets_irsa.arn
  }

  depends_on = [aws_eks_node_group.main]
}

resource "aws_iam_role" "external_secrets_irsa" {
  name = "${local.cluster_name}-external-secrets"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.cluster.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${replace(aws_iam_openid_connect_provider.cluster.url, "https://", "")}:sub" = "system:serviceaccount:external-secrets:external-secrets"
        }
      }
    }]
  })
}

resource "aws_iam_policy" "external_secrets" {
  name = "${local.cluster_name}-external-secrets"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
        Resource = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:/aims/${var.env}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/aims/${var.env}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "external_secrets" {
  role       = aws_iam_role.external_secrets_irsa.name
  policy_arn = aws_iam_policy.external_secrets.arn
}

data "aws_caller_identity" "current" {}

############################################################################
# Outputs
############################################################################

output "cluster_name" { value = aws_eks_cluster.main.name }
output "cluster_endpoint" { value = aws_eks_cluster.main.endpoint }
output "cluster_ca" { value = aws_eks_cluster.main.certificate_authority[0].data, sensitive = true }
output "oidc_provider_arn" { value = aws_iam_openid_connect_provider.cluster.arn }
output "oidc_provider_url" { value = aws_eks_cluster.main.identity[0].oidc[0].issuer }
output "kms_key_arn" { value = aws_kms_key.cluster.arn }
