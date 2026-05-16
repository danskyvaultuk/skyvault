terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # ── Remote state stored in S3 ───────────────────────────────────────────────
  # This bucket must exist BEFORE running terraform init.
  # We create it once with the AWS CLI bootstrap script below.
  backend "s3" {
    bucket  = "skyvault-tf-state-786971594750"
    key     = "skyvault/terraform.tfstate"
    region  = "eu-west-2"
    encrypt = true # server-side encryption on the state file
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "skyvault"
      ManagedBy = "terraform"
    }
  }
}
