#!/usr/bin/env python3
"""
live.py

Script per avviare lo streaming della pagina Flask su YouTube Live.

Prerequisiti:
  - Avere un file `client_secrets.json` (YouTube API credentials)
  - Avere `ffmpeg` installato sul sistema e raggiungibile in PATH
  - Le librerie pip:
      google-api-python-client
      google-auth-oauthlib
      google-auth-httplib2
      ffmpeg-python
  - Il server Flask deve essere in esecuzione (es. su http://localhost:8000)
  - Nella Google Cloud Console, sotto **APIs & Services > OAuth consent screen**, nella sezione **Test users**, aggiungere l'indirizzo email con cui effettui il login (altrimenti otterrai `access_denied`)
  - Il canale YouTube deve essere verificato e avere l'opzione Live Streaming abilitata: https://www.youtube.com/features

Esecuzione:
  python live.py
"""
import os
import subprocess
import datetime
import sys
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Scope per YouTube Live Streaming API
SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl']
CLIENT_SECRETS_FILE = 'client_secret.json'
TOKEN_FILE = 'token.pickle'

# Titoli e descrizioni del broadcast
BROADCAST_TITLE = 'Quadro Vivente'
STREAM_TITLE = 'QuadroVivente livestream'
STREAM_DESCRIPTION = 'Diretta in streaming del Quadro Vivente'

# URL della pagina da catturare
SOURCE_URL = 'http://localhost:8000'


def get_authenticated_service():
    """Autenticazione OAuth2 con salvataggio e riuso del token"""
    creds = None
    # Carica credenziali salvate se esistono
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, 'rb') as token:
            creds = pickle.load(token)
    # Se non ci sono credenziali valide, esegui il flow
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        # Salva le credenziali per le esecuzioni successive
        with open(TOKEN_FILE, 'wb') as token:
            pickle.dump(creds, token)
    return build('youtube', 'v3', credentials=creds)


def create_broadcast(youtube):
    """Crea un nuovo broadcast su YouTube Live"""
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    body = {
        'snippet': {
            'title': BROADCAST_TITLE,
            'scheduledStartTime': now,
            'description': STREAM_DESCRIPTION
        },
        'status': {
            'privacyStatus': 'public'
        },
        'contentDetails': {
            'enableAutoStart': True,
            'enableAutoStop': True
        }
    }
    try:
        response = youtube.liveBroadcasts().insert(
            part='snippet,status,contentDetails',
            body=body
        ).execute()
        return response['id']
    except HttpError as e:
        if e.resp.status == 403:
            print("\nErrore: il tuo canale YouTube non ha l'opzione Live Streaming abilitata.")
            print("Visita https://www.youtube.com/features per abilitare lo streaming dal tuo account.")
            sys.exit(1)
        else:
            raise


def create_stream(youtube):
    """Crea un nuovo stream RTMP su YouTube Live"""
    body = {
        'snippet': {'title': STREAM_TITLE},
        'cdn': {
            'format': '1080p',
            'ingestionType': 'rtmp'
        }
    }
    response = youtube.liveStreams().insert(
        part='snippet,cdn',
        body=body
    ).execute()
    info = response['cdn']['ingestionInfo']
    return response['id'], info['ingestionAddress'], info['streamName']


def bind_broadcast(youtube, broadcast_id, stream_id):
    """Collega il broadcast allo stream RTMP"""
    youtube.liveBroadcasts().bind(
        part='id,contentDetails',
        id=broadcast_id,
        streamId=stream_id
    ).execute()


def start_ffmpeg(ingestion_address, stream_name):
    """Avvia ffmpeg per catturare lo schermo e inviare il flusso a YouTube"""
    ingest_url = f"{ingestion_address}/{stream_name}"
    # Esempio per Linux X11 (adatta per il tuo sistema se necessario)
    command = [
        'ffmpeg',
        '-re',
        '-f', 'x11grab',
        '-s', '1280x720',
        '-i', ':0.0',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-f', 'flv',
        ingest_url
    ]
    subprocess.call(command)


def main():
    youtube = get_authenticated_service()
    broadcast_id = create_broadcast(youtube)
    stream_id, ing_addr, stream_name = create_stream(youtube)
    bind_broadcast(youtube, broadcast_id, stream_id)

    print(f"Ingestion address: {ing_addr}\nStream name: {stream_name}")
    print("Avvio lo streaming con ffmpeg...")
    start_ffmpeg(ing_addr, stream_name)


if __name__ == '__main__':
    main()
