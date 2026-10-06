# Vyasa server image. Content arrives as git mirrors fetched in-process;
# see deploy/k8s/README.md.
FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git openssh-client \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 vyasa

WORKDIR /opt/vyasa/src
COPY . .
RUN pip install --no-cache-dir ".[auth]"

ENV VYASA_VENDOR_DIR=/opt/vyasa/vendor
RUN python -m vyasa.vendor

ENV PYTHONUNBUFFERED=1 \
    VYASA_ROOT=/data \
    VYASA_HOST=0.0.0.0 \
    VYASA_PORT=5001 \
    VYASA_IGNORE_CWD_AS_ROOT=true \
    VYASA_GIT_MIRROR_ROOT=/data/.vyasa-mirrors \
    FORWARDED_ALLOW_IPS=*

RUN mkdir -p /data && chown vyasa:vyasa /data
USER vyasa
WORKDIR /data
EXPOSE 5001
CMD ["vyasa", "--no-browser", "--no-browser-reload"]
