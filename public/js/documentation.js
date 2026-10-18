document.addEventListener('DOMContentLoaded', function() {
    const helpButton = document.getElementById('helpButton');
    const documentationPanel = document.getElementById('documentationPanel');
    const closeButton = document.getElementById('closeDocumentation');
    const overlay = document.getElementById('documentationOverlay');
    const navItems = document.querySelectorAll('.doc-nav-item');
    
    // Apri il pannello di documentazione
    helpButton.addEventListener('click', function() {
      documentationPanel.classList.add('open');
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden'; // Previene lo scrolling della pagina sottostante
    });
    
    // Chiudi il pannello di documentazione
    function closeDocumentation() {
      documentationPanel.classList.remove('open');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
    
    closeButton.addEventListener('click', closeDocumentation);
    overlay.addEventListener('click', closeDocumentation);
    
    // Gestione della navigazione tra le sezioni
    navItems.forEach(item => {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Rimuovi la classe active da tutti gli elementi
        navItems.forEach(navItem => navItem.classList.remove('active'));
        document.querySelectorAll('.doc-section').forEach(section => section.classList.remove('active'));
        
        // Aggiungi la classe active all'elemento cliccato
        this.classList.add('active');
        
        // Mostra la sezione corrispondente
        const targetId = this.getAttribute('href').substring(1);
        document.getElementById(targetId).classList.add('active');
      });
    });
  });