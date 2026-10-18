# Script di monitoraggio per essere eseguito come Cron Job su Render.

import os
import sys
import logging
import time
from datetime import datetime
import yaml
import resend
import psutil

# Configura il logger per stampare su console, in modo che i log siano visibili nella dashboard di Render.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stdout  # Stampa su standard output
)
logger = logging.getLogger('MonitoringScript')


# Classe principale del sistema di alerting ---
class AlertingSystem:
    def __init__(self, config_file):
        """Inizializza il sistema caricando la configurazione."""
        self.config = self._load_config(config_file)
        self.sender_email = self.config.get('sender_email', 'alerts@sqlplayground.com')
        self.authorized_users = self.config.get('authorized_users', [])
        self.alerts_config = self.config.get('alerts', {})
        self.alert_history = {} # Semplice cronologia in-memory per il cooldown
        logger.info("Sistema di alerting inizializzato con la configurazione.")
        
    def _load_config(self, config_file):
        """Carica la configurazione da un file YAML."""
        try:
            with open(config_file, 'r') as file:
                return yaml.safe_load(file)
        except FileNotFoundError:
            logger.error(f"Errore critico: File di configurazione '{config_file}' non trovato.")
            sys.exit(1) # Esce se non trova la configurazione
        except Exception as e:
            logger.error(f"Errore nel caricamento del file di configurazione: {e}")
            sys.exit(1)
            
    def check_metric(self, metric_name, current_value):
        """Controlla se il valore di una metrica supera la soglia e invia un alert."""
        if metric_name not in self.alerts_config:
            logger.warning(f"Metrica '{metric_name}' non trovata nella configurazione. Salto il controllo.")
            return
        
        config = self.alerts_config[metric_name]
        threshold = config.get('threshold')
        comparison = config.get('comparison', 'greater')
        
        is_triggered = False
        if comparison == 'greater' and current_value > threshold:
            is_triggered = True
        elif comparison == 'less' and current_value < threshold:
            is_triggered = True
        
        if is_triggered:
            logger.warning(f"ALERT TRIGGERED: La metrica '{metric_name}' (valore: {current_value}) ha superato la soglia (soglia: {threshold}, condizione: {comparison}).")
            self.send_alert(metric_name, current_value, threshold, comparison)
        else:
            logger.info(f"OK: La metrica '{metric_name}' (valore: {current_value}) è entro i limiti (soglia: {threshold}).")

    def send_alert(self, metric_name, value, threshold, comparison):
        """Invia una notifica email tramite Resend."""
        try:
            resend.api_key = os.getenv('RESEND_API_KEY')
            if not resend.api_key:
                logger.error("La variabile d'ambiente RESEND_API_KEY non è impostata. Impossibile inviare l'alert.")
                return

            if not self.authorized_users:
                logger.error("Nessun utente autorizzato trovato nella configurazione. Impossibile inviare l'alert.")
                return

            subject = f"🚨 Allarme di Sistema: {metric_name.replace('_', ' ').title()} Critico"
            
            body_html = f"""
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }}
                    .header {{ background-color: #f8d7da; color: #721c24; padding: 10px; text-align: center; border-radius: 5px 5px 0 0; }}
                    .content {{ padding: 20px; }}
                    strong {{ color: #721c24; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Allarme Critico del Sistema</h2>
                    </div>
                    <div class="content">
                        <p>È stato rilevato un evento che richiede attenzione immediata:</p>
                        <ul>
                            <li><strong>Metrica:</strong> {metric_name.replace('_', ' ').title()}</li>
                            <li><strong>Valore Rilevato:</strong> {value:.2f}%</li>
                            <li><strong>Soglia Configurate:</strong> {comparison.replace('_', ' ')} di {threshold}%</li>
                            <li><strong>Data e Ora (UTC):</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}</li>
                        </ul>
                        <p>Si prega di verificare lo stato del servizio sulla dashboard di Render.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            params = {
                "from": self.sender_email,
                "to": self.authorized_users,
                "subject": subject,
                "html": body_html,
            }

            email_sent = resend.Emails.send(params)
            logger.info(f"Alert inviato con successo tramite Resend. ID: {email_sent['id']}")
            
        except Exception as e:
            logger.error(f"Fallimento nell'invio dell'alert con Resend: {e}", exc_info=True)


# Funzioni di raccolta metriche
def get_system_metrics():
    """Raccoglie e restituisce le metriche chiave di CPU, Memoria e Disco."""
    cpu_usage = psutil.cpu_percent(interval=1)
    memory_info = psutil.virtual_memory()
    memory_usage = memory_info.percent
    disk_info = psutil.disk_usage('/')
    disk_usage = disk_info.percent
    
    return {
        'cpu_usage': cpu_usage,
        'memory_usage': memory_usage,
        'disk_space': disk_usage, # Rinominiamo per coerenza con la config
    }


# Blocco di esecuzione principale
if __name__ == "__main__":
    logger.info("--- Avvio Task di Monitoraggio One-Shot ---")
    
    try:
        # Inizializza il sistema con il file di configurazione
        alerting_system = AlertingSystem('alerting_config.yaml')
        
        # Raccoglie le metriche
        metrics = get_system_metrics()
        logger.info(f"Metriche di sistema raccolte: {metrics}")
        
        # Controlla ogni metrica
        for metric_name, current_value in metrics.items():
            alerting_system.check_metric(metric_name, current_value)

        logger.info("--- Task di Monitoraggio Completato ---")
        sys.exit(0) # Esce con successo

    except Exception as e:
        logger.error(f"Errore fatale durante l'esecuzione dello script: {e}", exc_info=True)
        sys.exit(1) # Esce con un codice di errore