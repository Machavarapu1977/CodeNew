"""
email_service.py — OTP generation, hashing, and email delivery via SMTP.

Configuration (set in backend/.env):
    SMTP_HOST     e.g. smtp.gmail.com
    SMTP_PORT     e.g. 587
    SMTP_USER     your-sending@gmail.com
    SMTP_PASS     app-password-or-smtp-password
    EMAIL_FROM    "MockTest AI <your-sending@gmail.com>"

If SMTP credentials are not configured the OTP is printed to the console
so development still works without an email provider.
"""

import os
import secrets
import string
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

OTP_EXPIRY_MINUTES = 5
OTP_LENGTH = 6
MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60

_PLACEHOLDER_VALUES = {"", "your-email@gmail.com", "your-app-password"}


def _get_smtp_config():
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    passwd = os.getenv("SMTP_PASS", "").strip()
    email_from = os.getenv("EMAIL_FROM", f"MockTest AI <{user}>").strip()
    is_configured = bool(
        host
        and user not in _PLACEHOLDER_VALUES
        and passwd not in _PLACEHOLDER_VALUES
    )
    return host, port, user, passwd, email_from, is_configured


def generate_otp() -> str:
    """Return a cryptographically secure 6-digit OTP string."""
    digits = string.digits
    return "".join(secrets.choice(digits) for _ in range(OTP_LENGTH))


def hash_otp(otp: str) -> str:
    """SHA-256 hash of the OTP for server-side storage."""
    return hashlib.sha256(otp.encode()).hexdigest()


def verify_otp_hash(plain_otp: str, stored_hash: str) -> bool:
    """Constant-time comparison via hashing."""
    return hashlib.sha256(plain_otp.encode()).hexdigest() == stored_hash


def otp_expires_at() -> datetime:
    return datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)


def _send_smtp(to_email: str, subject: str, html_body: str) -> bool:
    """Send email via SMTP. Falls back to console print if not configured.
    Returns True if delivered via SMTP, False if dev fallback was used.
    """
    smtp_host, smtp_port, smtp_user, smtp_pass, email_from, is_configured = _get_smtp_config()
    if not is_configured:
        # Development fallback — print OTP to terminal immediately (flush=True for piped logs)
        print(f"\n{'='*50}", flush=True)
        print(f"[DEV EMAIL] To: {to_email}", flush=True)
        print(f"[DEV EMAIL] Subject: {subject}", flush=True)
        # Extract OTP from html for quick visibility
        import re
        otps = re.findall(r'\b\d{6}\b', html_body)
        if otps:
            print(f"[DEV EMAIL] OTP: {otps[0]}", flush=True)
        print(f"{'='*50}\n", flush=True)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = email_from
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, to_email, msg.as_string())
    return True


def send_signup_otp(to_email: str, name: str, otp: str) -> bool:
    subject = "Your MockTest AI Verification Code"
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;
                border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
        <h2 style="color:#1a202c;margin-bottom:4px;">Email Verification</h2>
        <p style="color:#4a5568;margin-top:0;">Hi {name or 'there'},</p>
        <p style="color:#4a5568;">
            Use the code below to verify your email address and activate your MockTest AI account.
        </p>
        <div style="background:#f7fafc;border:2px dashed #cbd5e0;border-radius:8px;
                    padding:24px;text-align:center;margin:24px 0;">
            <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#2d3748;
                         font-family:monospace;">{otp}</span>
        </div>
        <p style="color:#718096;font-size:13px;">
            This code expires in <strong>{OTP_EXPIRY_MINUTES} minutes</strong>.
            If you did not request this, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
        <p style="color:#a0aec0;font-size:11px;text-align:center;">MockTest AI — Secure Examination Platform</p>
    </div>
    """
    return _send_smtp(to_email, subject, html_body)


def send_reset_otp(to_email: str, otp: str) -> bool:
    subject = "MockTest AI — Password Reset Code"
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;
                border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
        <h2 style="color:#1a202c;margin-bottom:4px;">Password Reset</h2>
        <p style="color:#4a5568;">
            You requested a password reset for your MockTest AI account.
            Enter the code below to proceed.
        </p>
        <div style="background:#fff5f5;border:2px dashed #feb2b2;border-radius:8px;
                    padding:24px;text-align:center;margin:24px 0;">
            <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#c53030;
                         font-family:monospace;">{otp}</span>
        </div>
        <p style="color:#718096;font-size:13px;">
            This code expires in <strong>{OTP_EXPIRY_MINUTES} minutes</strong>.
            If you did not request a reset, please secure your account immediately.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
        <p style="color:#a0aec0;font-size:11px;text-align:center;">MockTest AI — Secure Examination Platform</p>
    </div>
    """
    return _send_smtp(to_email, subject, html_body)
