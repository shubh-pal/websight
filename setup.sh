#!/bin/bash
# ✦ WebSight AWS Spot Instance Setup ✦
# Run this on a fresh Ubuntu instance (20.04 or 22.04 LTS)

set -e

echo "🚀 Starting server preparation..."

# 1. Add Swap Space (Crucial for 2GB RAM instances)
if [ ! -f /swapfile ]; then
    echo "🏗️ Setting up 2GB swap space..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# 2. Update System
sudo apt-get update && sudo apt-get upgrade -y

# 3. Install Docker
if ! [ -x "$(command -v docker)" ]; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# 4. Install Docker Compose
if ! [ -x "$(command -v docker-compose)" ]; then
    echo "📑 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

echo "✅ Server dependencies ready!"
echo "--------------------------------------------------------"
echo "👉 NEXT STEPS:"
echo "1. Upload your code to this server (git clone or scp)"
echo "2. cd into your project directory"
echo "3. Edit your backend/.env manually (or copy it over)"
echo "4. Run: docker-compose up --build -d"
echo "--------------------------------------------------------"
