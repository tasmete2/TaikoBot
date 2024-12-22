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

# Cron job'u tanımlama - Sabit zaman olarak 08:30
CRON_JOB="30 08 * * * $NODE_PATH $PROJECT_PATH/index.js"

# Yeni cron job'u ekleme
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "Cron job added successfully. The bot will run every day at 08:30 UTC."
