# These values are printed after terraform apply.
# Copy them into your .env.local

output "uploads_bucket_name" {
  description = "S3 bucket name — goes into AWS_S3_BUCKET_NAME"
  value       = aws_s3_bucket.uploads.id
}

output "uploads_bucket_region" {
  description = "S3 bucket region — goes into AWS_REGION"
  value       = aws_s3_bucket.uploads.region
}

output "app_access_key_id" {
  description = "IAM access key ID — goes into AWS_ACCESS_KEY_ID"
  value       = aws_iam_access_key.skyvault_app.id
}

output "app_secret_access_key" {
  description = "IAM secret key — goes into AWS_SECRET_ACCESS_KEY"
  value       = aws_iam_access_key.skyvault_app.secret
  sensitive   = true # hidden in logs, use: terraform output -raw app_secret_access_key
}
