from monitoring.alerting_system import AlertingSystem

alerting = AlertingSystem('alerting_config.yaml')

# CPU usage oltre la soglia (dovrebbe inviare un alert)
print("Test 1: CPU usage oltre la soglia")
alerting.check_metric('cpu_usage', 95)

print("Controlla il file alerting_system.log e la tua email")