"""
Servidor HTTPS local para desarrollo WebXR (Meta Quest 2/3).

WebXR requiere un contexto seguro (HTTPS) salvo en localhost. Para probar
desde el visor a traves de la red WiFi local, necesitas HTTPS aunque sea con
un certificado autofirmado. Este script genera el certificado automaticamente
y sirve la carpeta actual.

Uso:
    python server.py            # puerto 8443 por defecto
    python server.py 9000       # puerto personalizado
"""

import datetime
import http.server
import ipaddress
import os
import socket
import ssl
import sys

CERT_FILE = "dev-cert.pem"
KEY_FILE = "dev-key.pem"


def get_local_ips():
    ips = {"127.0.0.1"}
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None):
            ip = info[4][0]
            if ":" not in ip:  # solo IPv4
                ips.add(ip)
    except Exception:
        pass
    # Truco para obtener la IP de salida sin enviar datos
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    return sorted(ips)


def generate_self_signed_cert(local_ips):
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
    except ImportError:
        print("\n[ERROR] Falta el paquete 'cryptography'.")
        print("Instalalo con:  python -m pip install cryptography\n")
        sys.exit(1)

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
    ])

    san = [x509.DNSName("localhost")]
    for ip in local_ips:
        try:
            san.append(x509.IPAddress(ipaddress.ip_address(ip)))
        except ValueError:
            pass

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.utcnow() - datetime.timedelta(days=1))
        .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=825))
        .add_extension(x509.SubjectAlternativeName(san), critical=False)
        .sign(key, hashes.SHA256())
    )

    with open(KEY_FILE, "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))

    with open(CERT_FILE, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    print(f"[OK] Certificado autofirmado generado: {CERT_FILE} / {KEY_FILE}")


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8443
    local_ips = get_local_ips()

    if not (os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE)):
        generate_self_signed_cert(local_ips)

    handler = http.server.SimpleHTTPRequestHandler
    httpd = http.server.ThreadingHTTPServer(("0.0.0.0", port), handler)

    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

    print("\n==============================================")
    print(" Servidor HTTPS WebXR en ejecucion")
    print("==============================================")
    print(f" Local:   https://localhost:{port}")
    for ip in local_ips:
        if ip != "127.0.0.1":
            print(f" Red:     https://{ip}:{port}   <-- usa esta en el Quest")
    print("==============================================")
    print(" En el Quest: acepta el aviso de certificado")
    print(" (Avanzado -> Continuar de todos modos).")
    print(" Ctrl+C para detener.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")


if __name__ == "__main__":
    main()
