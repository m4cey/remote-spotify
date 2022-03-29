#
# Copyright (c) 2021 Matthew Penner
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
#

FROM        node:16-bullseye-slim

LABEL       author="Matthew Penner" maintainer="matthew@pterodactyl.io"

LABEL       org.opencontainers.image.source="https://github.com/pterodactyl/yolks"
LABEL       org.opencontainers.image.licenses=MIT

ADD	        https://raw.githubusercontent.com/alaister-net/yolks/master/ca.pem /usr/local/share/ca-certificates/mitmproxy.crt

RUN         apt update -y \
            && apt install -y curl wget ca-certificates openssl git tar zip unzip sqlite3 libsqlite3-dev python3 python3-dev fontconfig libfreetype6 tzdata iproute2 libstdc++6 ffmpeg dnsutils build-essential libtool gnupg \
						&& wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
						&& sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
						&& apt-get update \
 						&& apt-get install -y google-chrome-stable libxss1 --no-install-recommends \
						&& rm -rf /var/lib/apt/lists/* \
            && chmod 644 /usr/local/share/ca-certificates/mitmproxy.crt && update-ca-certificates \
            && npm install -g npm@latest \
            && corepack enable \
            && npm config set python python3 \
            && groupadd -r pptruser && useradd -d /home/container -g pptruser -G audio,video -m container

USER        container
ENV         USER=container HOME=/home/container
WORKDIR     /home/container

COPY				./entrypoint.sh /entrypoint.sh
CMD         [ "/bin/bash", "/entrypoint.sh" ]
