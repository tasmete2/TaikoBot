#!/bin/bash

# Node.js yolunu belirleme
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
  echo "Node.js is not installed. Please install Node.js and try again."
  exit 1
fi

# Proje dizininin tam yolunu belirleme
PROJECT_PATH=$(pwd)

# index.js dosyasının mevcut olup olmadığını kontrol etme
if [ ! -f "$PROJECT_PATH/index.js" ]; then
  echo "index.js not found in the current directory. Please navigate to the project directory and try again."
  exit 1
fi

# Rastgele bir saat ve dakika oluşturma (08:30 ile 12:00 arasında)
RANDOM_HOUR=$((8 + RANDOM % 3))
RANDOM_MINUTE=$((RANDOM % 60))

# Cron job'u tanımlama - Rastgele zaman
CRON_JOB="$RANDOM_MINUTE $RANDOM_HOUR * * * $NODE_PATH $PROJECT_PATH/index.js"

# Yeni cron job'u ekleme (mevcut cron job'ları temizleyerek)
(crontab -l 2>/dev/null | grep -v "$NODE_PATH $PROJECT_PATH/index.js"; echo "$CRON_JOB") | crontab -

echo "Cron job added successfully. The bot will run tomorrow at $RANDOM_HOUR:$RANDOM_MINUTE."

# Gelecek cron job'ları sadece 18 Mart 2025'e kadar çalıştırma
END_DATE="2025-03-18"
CURRENT_DATE=$(date +%Y-%m-%d)
if [[ "$CURRENT_DATE" > "$END_DATE" ]]; then
  (crontab -l 2>/dev/null | grep -v "$NODE_PATH $PROJECT_PATH/index.js") | crontab -
  echo "Script has reached its end date. Cron job removed."
fi
