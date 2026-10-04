from email.mime.base import MIMEBase
from email import encoders
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 465 # SSL
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "indiagetyourresult@gmail.com")
APP_PASSWORD = os.getenv("APP_PASSWORD", "qfaftniikmilgoaq")

def send_email(to_email, subject, body_html):
    msg = MIMEMultipart("alternative")
    msg['Subject'] = subject
    msg['From'] = SENDER_EMAIL
    msg['To'] = to_email

    msg.attach(MIMEText(body_html, 'html'))

    try:
        # Connecting to Gmail's SMTP server
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(SENDER_EMAIL, APP_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
            print(f"✅ Email sent successfully to {to_email}")
            return True
    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {e}")
        return False

def send_email_with_attachment(to_email, subject, body_html, filepath):
    msg = MIMEMultipart("mixed")
    msg['Subject'] = subject
    msg['From'] = SENDER_EMAIL
    msg['To'] = to_email

    msg.attach(MIMEText(body_html, 'html'))

    if filepath and os.path.exists(filepath):
        filename = os.path.basename(filepath)
        with open(filepath, "rb") as attachment:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f"attachment; filename= {filename}")
        msg.attach(part)

    try:
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(SENDER_EMAIL, APP_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
            print(f"✅ Email with attachment sent successfully to {to_email}")
            return True
    except Exception as e:
        print(f"❌ Failed to send email with attachment to {to_email}: {e}")
        return False
