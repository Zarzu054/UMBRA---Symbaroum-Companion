#!/usr/bin/env python3
import argparse
import mimetypes
import os
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
      raise SystemExit(f"Falta {name} en el entorno SMTP.")
    return value


def parse_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def attach_file(message: EmailMessage, path: Path) -> None:
    content_type, _ = mimetypes.guess_type(path.name)
    if content_type is None:
        content_type = "application/octet-stream"

    maintype, subtype = content_type.split("/", 1)
    message.add_attachment(
        path.read_bytes(),
        maintype=maintype,
        subtype=subtype,
        filename=path.name,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Send a PostgreSQL backup by email.")
    parser.add_argument("--to", required=True, help="Destination email address.")
    parser.add_argument("--backup", required=True, help="Path to the .dump backup file.")
    parser.add_argument("--checksum", help="Path to the optional .sha256 checksum file.")
    args = parser.parse_args()

    backup_path = Path(args.backup)
    if not backup_path.is_file():
        raise SystemExit(f"No existe el backup: {backup_path}")

    checksum_path = Path(args.checksum) if args.checksum else None
    if checksum_path and not checksum_path.is_file():
        raise SystemExit(f"No existe el checksum: {checksum_path}")

    smtp_host = required_env("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_secure = parse_bool(os.environ.get("SMTP_SECURE", "false"))
    smtp_user = os.environ.get("SMTP_USER", "").strip()
    smtp_pass = os.environ.get("SMTP_PASS", "").strip()
    smtp_from = os.environ.get("SMTP_FROM", "").strip() or smtp_user

    if not smtp_from:
        raise SystemExit("Falta SMTP_FROM o SMTP_USER para definir el remitente.")

    message = EmailMessage()
    message["Subject"] = f"UMBRA PostgreSQL backup - {backup_path.name}"
    message["From"] = smtp_from
    message["To"] = args.to
    message.set_content(
        "Attached is a PostgreSQL backup for UMBRA.\n\n"
        "Keep this file private. It can contain user data, password hashes, "
        "session tokens, characters, campaigns, notes and other application data.\n"
    )

    attach_file(message, backup_path)
    if checksum_path:
        attach_file(message, checksum_path)

    if smtp_secure:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context) as server:
            if smtp_user or smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.send_message(message)
    else:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            if smtp_user or smtp_pass:
                context = ssl.create_default_context()
                server.starttls(context=context)
                server.ehlo()
                server.login(smtp_user, smtp_pass)
            server.send_message(message)


if __name__ == "__main__":
    main()
