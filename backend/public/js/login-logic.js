// public/js/login-logic.js - Versione robusta

document.addEventListener('DOMContentLoaded', function() {
    // Elementi DOM - con controlli di sicurezza
    const loginForm = document.getElementById('loginForm') || document.querySelector('form[action*="login"]') || document.querySelector('form');
    const emailInput = document.getElementById('email') || document.getElementById('username') || document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]') || document.querySelector('input[name="username"]');
    const passwordInput = document.getElementById('password') || document.querySelector('input[type="password"]') || document.querySelector('input[name="password"]');
    const togglePasswordBtn = document.getElementById('toggle-password') || document.querySelector('[data-toggle="password"]');
    const errorAlert = document.getElementById('error-alert') || document.querySelector('.alert-danger');
    const errorMessage = document.getElementById('error-message') || (errorAlert && errorAlert.querySelector('span')) || errorAlert;
    const loginBtn = document.getElementById('login-btn') || document.querySelector('button[type="submit"]') || document.querySelector('input[type="submit"]');
    const rememberMeCheckbox = document.getElementById('remember-me') || document.querySelector('input[name="remember-me"]') || document.querySelector('input[type="checkbox"]');
    
    // Elementi per lo spinner (potrebbero non esistere)
    const loginText = document.getElementById('login-text');
    const loginSpinner = document.getElementById('login-spinner');
    
    // Controlla se l'utente è già loggato
    const token = localStorage.getItem('accessToken');
    if (token) {
        // Verifica se il token è valido
        fetch('/api/auth/sessions', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                // Token valido, redirect al monitoring
                window.location.href = '/monitoring';
            } else {
                // Token non valido, rimuovilo
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
            }
        })
        .catch(() => {
            // Errore di rete, lascia l'utente sulla pagina di login
        });
    }
    
    // Toggle password visibility - SOLO se il bottone esiste
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Cambia icona se esiste
            const icon = this.querySelector('i') || this.querySelector('svg');
            if (icon) {
                if (icon.tagName === 'I') {
                    icon.classList.toggle('fa-eye');
                    icon.classList.toggle('fa-eye-slash');
                } else {
                    // Per altre implementazioni di icone
                    this.textContent = type === 'password' ? '👁' : '👁‍🗨';
                }
            }
        });
    }
    
    // Carica email salvata se "Ricordami" era selezionato
    if (rememberMeCheckbox && emailInput) {
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (savedEmail) {
            emailInput.value = savedEmail;
            rememberMeCheckbox.checked = true;
        }
    }
    
    // Gestione submit form
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Reset errori
            hideError();
            
            // Disabilita form
            setLoadingState(true);
            
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            
            // Validazione base
            if (!email || !password) {
                showError('Inserisci email/username e password');
                setLoadingState(false);
                return;
            }
            
            try {
                // Effettua la richiesta di login
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    
                    // Salva i token
                    localStorage.setItem('accessToken', data.accessToken);
                    localStorage.setItem('refreshToken', data.refreshToken);
                    
                    // Salva email se "Ricordami" è selezionato
                    if (rememberMeCheckbox && rememberMeCheckbox.checked) {
                        localStorage.setItem('rememberedEmail', email);
                    } else {
                        localStorage.removeItem('rememberedEmail');
                    }
                    
                    // Salva info utente
                    if (data.user) {
                        localStorage.setItem('userInfo', JSON.stringify({
                            id: data.user.id,
                            email: data.user.email,
                            username: data.user.username,
                            role: data.user.role
                        }));
                    }
                    
                    // Mostra messaggio di successo
                    showSuccess('Login riuscito! Reindirizzamento...');
                    
                    // Redirect al monitoring dopo un breve delay
                    setTimeout(() => {
                        window.location.href = '/monitoring';
                    }, 500);
                    
                } else {
                    // Login fallito
                    const errorMsg = data.message || 'Credenziali non valide';
                    showError(errorMsg);
                    setLoadingState(false);
                    
                    // Se è un errore di ruolo, mostra un messaggio più specifico
                    if (response.status === 403) {
                        showError('Accesso negato. Solo gli amministratori possono accedere.');
                    }
                }
                
            } catch (error) {
                console.error('Login error:', error);
                showError('Errore di connessione. Riprova più tardi.');
                setLoadingState(false);
            }
        });
    }
    
    // Funzioni helper
    function showError(message) {
        if (errorMessage) {
            if (errorMessage.tagName === 'SPAN' || errorMessage.tagName === 'DIV') {
                errorMessage.textContent = message;
            } else {
                errorMessage.innerHTML = message;
            }
        }
        
        if (errorAlert) {
            errorAlert.classList.remove('d-none', 'hidden');
            errorAlert.style.display = 'block';
            
            // Assicurati che sia visibile come errore
            errorAlert.classList.remove('alert-success', 'alert-info');
            errorAlert.classList.add('alert-danger', 'alert');
        } else {
            // Fallback: usa alert del browser
            alert('Errore: ' + message);
        }
    }
    
    function showSuccess(message) {
        if (errorMessage) {
            if (errorMessage.tagName === 'SPAN' || errorMessage.tagName === 'DIV') {
                errorMessage.textContent = message;
            } else {
                errorMessage.innerHTML = message;
            }
        }
        
        if (errorAlert) {
            errorAlert.classList.remove('d-none', 'hidden');
            errorAlert.style.display = 'block';
            
            // Cambia in successo
            errorAlert.classList.remove('alert-danger');
            errorAlert.classList.add('alert-success');
            
            // Cambia icona se esiste
            const icon = errorAlert.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-check-circle';
            }
        }
    }
    
    function hideError() {
        if (errorAlert) {
            errorAlert.classList.add('d-none', 'hidden');
            errorAlert.style.display = 'none';
        }
    }
    
    function setLoadingState(loading) {
        if (loading) {
            // Disabilita input
            if (loginBtn) loginBtn.disabled = true;
            if (emailInput) emailInput.disabled = true;
            if (passwordInput) passwordInput.disabled = true;
            if (togglePasswordBtn) togglePasswordBtn.disabled = true;
            
            // Gestisci testo/spinner del bottone
            if (loginText && loginSpinner) {
                loginText.classList.add('d-none', 'hidden');
                loginSpinner.classList.remove('d-none', 'hidden');
            } else if (loginBtn) {
                // Fallback: cambia solo il testo
                loginBtn.setAttribute('data-original-text', loginBtn.textContent);
                loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Accesso in corso...';
            }
        } else {
            // Riabilita input
            if (loginBtn) loginBtn.disabled = false;
            if (emailInput) emailInput.disabled = false;
            if (passwordInput) passwordInput.disabled = false;
            if (togglePasswordBtn) togglePasswordBtn.disabled = false;
            
            // Ripristina testo/spinner
            if (loginText && loginSpinner) {
                loginText.classList.remove('d-none', 'hidden');
                loginSpinner.classList.add('d-none', 'hidden');
            } else if (loginBtn && loginBtn.getAttribute('data-original-text')) {
                // Fallback: ripristina il testo originale
                loginBtn.textContent = loginBtn.getAttribute('data-original-text');
            }
        }
    }
    
    // Gestione tasto Enter
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && loginForm) {
                loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        });
    }
    
    // Focus sul primo campo vuoto
    if (emailInput && !emailInput.value) {
        emailInput.focus();
    } else if (passwordInput) {
        passwordInput.focus();
    }
});