# ── Uploads bucket ────────────────────────────────────────────────────────────
# This is where roof images and generated PDFs are stored.
# Files are private — accessed only via presigned URLs.

resource "aws_s3_bucket" "uploads" {
  bucket = var.uploads_bucket_name
}

# Versioning: keeps old copies of files if they're overwritten
resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Encryption: files at rest are encrypted with AES-256
resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block all public access — nobody can make files public accidentally
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS: allows the browser to PUT files directly to S3 using presigned URLs.
# Security is enforced by the presigned URL itself (time-limited, scoped to one key)
# so allowing all origins is safe and avoids breaking new domains/previews.
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# ── Public assets bucket ──────────────────────────────────────────────────────
# Blog models, orthophotos, and other public-facing static assets.
# Only the blog/ prefix is world-readable — no private survey data goes here.

resource "aws_s3_bucket" "public_assets" {
  bucket = var.public_assets_bucket_name
}

# Public access is intentional — this bucket serves blog content
resource "aws_s3_bucket_public_access_block" "public_assets" {
  bucket                  = aws_s3_bucket.public_assets.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Bucket policy: allow anonymous GET on blog/* only
resource "aws_s3_bucket_policy" "public_assets" {
  bucket     = aws_s3_bucket.public_assets.id
  depends_on = [aws_s3_bucket_public_access_block.public_assets]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowPublicReadBlogPrefix"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.public_assets.arn}/blog/*"
      }
    ]
  })
}

# CORS: allow model-viewer to fetch the GLB from any origin
resource "aws_s3_bucket_cors_configuration" "public_assets" {
  bucket = aws_s3_bucket.public_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
    max_age_seconds = 86400
  }
}

# ── IAM: app user + scoped policy ─────────────────────────────────────────────
# A dedicated IAM user for the app — only has access to the uploads bucket.
# Never use your personal AWS credentials in the app.

resource "aws_iam_user" "skyvault_app" {
  name = "skyvault-app"
}

# Least-privilege policy: only the actions the app actually needs
resource "aws_iam_policy" "s3_uploads" {
  name        = "skyvault-s3-uploads"
  description = "SkyVault app read/write access to the uploads bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Upload new files and read existing ones
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
        ]
        Resource = "${aws_s3_bucket.uploads.arn}/*"
      },
      {
        # List bucket contents (needed for some SDK operations)
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.uploads.arn
      }
    ]
  })
}

resource "aws_iam_user_policy_attachment" "skyvault_app_s3" {
  user       = aws_iam_user.skyvault_app.name
  policy_arn = aws_iam_policy.s3_uploads.arn
}

# Programmatic access key — the app uses these credentials
resource "aws_iam_access_key" "skyvault_app" {
  user = aws_iam_user.skyvault_app.name
}
