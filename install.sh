#!/bin/bash

# Script di installazione completa per Quadri Viventi
# Da eseguire su Raspberry Pi

echo "========================================="
echo "  INSTALLAZIONE QUADRI VIVENTI"
echo "========================================="

# Verifica che sia eseguito come root
if [ "$EUID" -ne 0 ]; then
    echo "Errore: Questo script deve essere eseguito con sudo"
    exit 1
fi

# Variabili
PROJECT_DIR="/home/giova/QuadroVivente"
USER="pi"

# Crea directory del progetto
echo "Creazione directory del progetto..."
mkdir -p $PROJECT_DIR
chown $USER:$USER $PROJECT_DIR

# Crea struttura directory
echo "Creazione struttura directory..."
mkdir -p $PROJECT_DIR/data
mkdir -p $PROJECT_DIR/home
mkdir -p $PROJECT_DIR/quadri_nuovi
mkdir -p $PROJECT_DIR/fullscreen
mkdir -p $PROJECT_DIR/logs
chown -R $USER:$USER $PROJECT_DIR

# Aggiorna il sistema
echo "Aggiornamento del sistema..."
apt update && apt upgrade -y

# Installa Python e pip
echo "Installazione Python e pip..."
apt install -y python3 python3-pip python3-venv

# Installa pacchetti per Access Point
echo "Installazione pacchetti Access Point..."
apt install -y hostapd dnsmasq iptables-persistent

# Crea virtual environment Python
echo "Creazione virtual environment Python..."
cd $PROJECT_DIR
python3 -m venv venv
chown -R $USER:$USER venv

# Attiva virtual environment e installa dipendenze
echo "Installazione dipendenze Python..."
source venv/bin/activate
pip install --upgrade pip
pip install Flask==2.3.3 Flask-SocketIO==5.3.6 Flask-CORS==4.0.0 python-socketio==5.9.0 eventlet==0.33.3 Werkzeug==2.3.7

# Ferma i servizi per la configurazione
echo "Fermando servizi per configurazione..."
systemctl stop hostapd
systemctl stop dnsmasq

# Backup delle configurazioni originali
echo "Backup delle configurazioni..."
cp /etc/dhcpcd.conf /etc/dhcpcd.conf.backup 2>/dev/null || true
cp /etc/dnsmasq.conf /etc/dnsmasq.conf.backup 2>/dev/null || true

# Configurazione interfaccia wlan0 statica
echo "Configurazione interfaccia wlan0..."
cat >> /etc/dhcpcd.conf << EOF

# Configurazione Access Point Quadri Viventi
interface wlan0
static ip_address=192.168.4.1/24
nohook wpa_supplicant
EOF

# Configurazione DHCP con dnsmasq
echo "Configurazione DHCP server..."
cat > /etc/dnsmasq.conf << EOF
# Configurazione DHCP per Quadri Viventi
interface=wlan0
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h
domain=quadriviventi.local
address=/quadriviventi.local/192.168.4.1
address=/raspberrypi.local/192.168.4.1
address=/server.local/192.168.4.1

# Opzioni DHCP
dhcp-option=3,192.168.4.1    # Default gateway
dhcp-option=6,192.168.4.1    # DNS server

# Log delle richieste DHCP
log-dhcp

# Cache DNS
cache-size=1000
EOF

# Configurazione hostapd
echo "Configurazione WiFi Access Point..."
cat > /etc/hostapd/hostapd.conf << EOF
# Configurazione Access Point Quadri Viventi
interface=wlan0
driver=nl80211
ssid=QuadriViventi_WiFi
hw_mode=g
channel=7
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=quadriviventi2025
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP

# Configurazioni avanzate
beacon_int=100
dtim_period=2
max_num_sta=20
rts_threshold=2347
fragm_threshold=2346
EOF

# Specifica il file di configurazione hostapd
echo "Configurazione hostapd daemon..."
cat > /etc/default/hostapd << EOF
DAEMON_CONF="/etc/hostapd/hostapd.conf"
EOF

# Abilita IP forwarding
echo "Abilitazione IP forwarding..."
sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf

# Configura iptables
echo "Configurazione iptables..."
iptables -F
iptables -t nat -F
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
iptables -A FORWARD -i eth0 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT
iptables -A FORWARD -i wlan0 -o eth0 -j ACCEPT

# Salva le regole iptables
sh -c "iptables-save > /etc/iptables/rules.v4"

# Crea script di avvio del server
cat > $PROJECT_DIR/start_server.sh << 'EOF'
#!/bin/bash
cd /home/pi/QuadroVivente
source venv/bin/activate
python3 server.py
EOF

chmod +x $PROJECT_DIR/start_server.sh
chown $USER:$USER $PROJECT_DIR/start_server.sh

# Crea servizio systemd
cat > /etc/systemd/system/quadri-server.service << EOF
[Unit]
Description=Quadri Viventi Server
After=network.target hostapd.service dnsmasq.service
Wants=hostapd.service dnsmasq.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$PROJECT_DIR/venv/bin/python server.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Abilita i servizi
echo "Abilitazione servizi..."
systemctl daemon-reload
systemctl unmask hostapd
systemctl enable hostapd
systemctl enable dnsmasq
systemctl enable quadri-server

# Crea script di gestione
cat > $PROJECT_DIR/manage.sh << 'EOF'
#!/bin/bash

case "$1" in
    start)
        echo "Avvio servizi Quadri Viventi..."
        sudo systemctl start hostapd
        sudo systemctl start dnsmasq
        sudo systemctl start quadri-server
        ;;
    stop)
        echo "Arresto servizi Quadri Viventi..."
        sudo systemctl stop quadri-server
        sudo systemctl stop hostapd
        sudo systemctl stop dnsmasq
        ;;
    restart)
        echo "Riavvio servizi Quadri Viventi..."
        sudo systemctl restart hostapd
        sudo systemctl restart dnsmasq
        sudo systemctl restart quadri-server
        ;;
    status)
        echo "Stato servizi Quadri Viventi:"
        sudo systemctl status hostapd --no-pager -l
        sudo systemctl status dnsmasq --no-pager -l
        sudo systemctl status quadri-server --no-pager -l
        ;;
    logs)
        echo "Log del server:"
        sudo journalctl -u quadri-server -f
        ;;
    *)
        echo "Uso: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
EOF

chmod +x $PROJECT_DIR/manage.sh
chown $USER:$USER $PROJECT_DIR/manage.sh

# Crea configurazione di default per il sistema
cat > $PROJECT_DIR/data/default_config.json << 'EOF'
{
  "system": {
    "name": "Quadri Viventi",
    "version": "1.0.0",
    "data_retention_minutes": 3,
    "auto_cleanup": true
  },
  "network": {
    "ssid": "QuadriViventi_WiFi",
    "password": "quadriviventi2025",
    "ip": "192.168.4.1",
    "dhcp_start": "192.168.4.2",
    "dhcp_end": "192.168.4.20"
  },
  "server": {
    "host": "0.0.0.0",
    "port": 8000,
    "debug": false
  }
}
EOF

chown $USER:$USER $PROJECT_DIR/data/default_config.json

echo "========================================="
echo "  INSTALLAZIONE COMPLETATA"
echo "========================================="
echo "Configurazione Access Point:"
echo "  SSID: QuadriViventi_WiFi"
echo "  Password: quadriviventi2025"
echo "  IP Raspberry: 192.168.4.1"
echo "  Range DHCP: 192.168.4.2 - 192.168.4.20"
echo ""
echo "Server Web:"
echo "  URL: http://192.168.4.1:8000"
echo "  Directory: $PROJECT_DIR"
echo ""
echo "Gestione servizi:"
echo "  $PROJECT_DIR/manage.sh start|stop|restart|status|logs"
echo ""
echo "IMPORTANTE:"
echo "1. Copia i file HTML, CSS e JS nella directory $PROJECT_DIR"
echo "2. Riavvia il sistema: sudo reboot"
echo "3. Verifica che i servizi siano attivi dopo il riavvio"
echo "========================================="