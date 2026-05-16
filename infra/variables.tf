variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "eu-west-2" # London — change to us-east-1 etc. if preferred
}

variable "uploads_bucket_name" {
  description = "S3 bucket name for SkyVault file uploads (must be globally unique)"
  type        = string
  default     = "skyvault-uploads-786971594750" # account ID suffix ensures uniqueness
}

variable "state_bucket_name" {
  description = "S3 bucket that stores Terraform state (created manually before init)"
  type        = string
  default     = "skyvault-tf-state-786971594750"
}

variable "app_url" {
  description = "App origin allowed to make presigned PUT requests (CORS)"
  type        = string
  default     = "http://localhost:3000"
}
