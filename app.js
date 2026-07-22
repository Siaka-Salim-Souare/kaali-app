import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://dohdwtwjqvlbadqwhdev.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KIvEiuKuo9CbtP2TJOGVtw_h_ZpcZXF';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ETAT DE L'APPLICATION ---
let sessionToken = null;
let boutiqueNom = null;
let clients = []; // { id, nom, telephone, solde }
let clientSelectionne = null;

// --- ELEMENTS DOM ---
const ecranLogin = document.getElementById('ecran-login');
const ecranPrincipal = document.getElementById('ecran-principal');
const indicateurHorsLigne = document.getElementById('indicateur-hors-ligne');

// ============ GESTION CONNEXION / INSCRIPTION ============

document.getElementById('btn-connexion').addEventListener('click', async () => {
  const telephone = document.getElementById('login-telephone').value.trim();
  const pin = document.getElementById('login-pin').value.trim();
  const messageErreur = document.getElementById('login-erreur');
  messageErreur.textContent = '';

  if (!telephone || !pin) {
    messageErreur.textContent = 'Remplis le téléphone et le PIN.';
    return;
  }

  const { data, error } = await supabase.rpc('connexion_boutique', {
    p_telephone: telephone,
    p_pin: pin
  });

  if (error || !data || data.length === 0) {
    messageErreur.textContent = 'Numéro ou PIN incorrect.';
    return;
  }

  const resultat = data[0];
  sessionToken = resultat.session_token;
  boutiqueNom = resultat.boutique_nom;
  localStorage.setItem('kaali_session_token', sessionToken);
  localStorage.setItem('kaali_boutique_nom', boutiqueNom);
  demarrerApp();
});

document.getElementById('btn-creation').addEventListener('click', async () => {
  const nom = document.getElementById('signup-nom').value.trim();
  const telephone = document.getElementById('login-telephone').value.trim();
  const pin = document.getElementById('login-pin').value.trim();
  const messageErreur = document.getElementById('login-erreur');
  messageErreur.textContent = '';

  if (!nom || !telephone || !pin || pin.length !== 4) {
    messageErreur.textContent = 'Remplis le nom, le téléphone, et un PIN à 4 chiffres.';
    return;
  }

  const { data, error } = await supabase.rpc('creer_boutique', {
    p_nom: nom,
    p_telephone: telephone,
    p_pin: pin
  });

  if (error || !data || data.length === 0) {
    messageErreur.textContent = error?.message?.includes('duplicate')
      ? 'Ce numéro est déjà enregistré. Connecte-toi plutôt.'
      : 'Erreur : ' + (error?.message || 'inconnue');
    return;
  }

  const resultat = data[0];
  sessionToken = resultat.session_token;
  boutiqueNom = resultat.boutique_nom;
  localStorage.setItem('kaali_session_token', sessionToken);
  localStorage.setItem('kaali_boutique_nom', boutiqueNom);
  demarrerApp();
});

document.getElementById('btn-deconnexion').addEventListener('click', () => {
  localStorage.removeItem('kaali_session_token');
  localStorage.removeItem('kaali_boutique_nom');
  sessionToken = null;
  ecranPrincipal.classList.add('cache');
  ecranLogin.classList.remove('cache');
});

// ============ DEMARRAGE APP ============

async function demarrerApp() {
  ecranLogin.classList.add('cache');
  ecranPrincipal.classList.remove('cache');
  document.getElementById('nom-boutique-affiche').textContent = boutiqueNom;
  await chargerClients();
}

async function tenterReconnexionAuto() {
  const tokenSauvegarde = localStorage.getItem('kaali_session_token');
  const nomSauvegarde = localStorage.getItem('kaali_boutique_nom');
  if (!tokenSauvegarde) return;

  sessionToken = tokenSauvegarde;
  boutiqueNom = nomSauvegarde;

  // On vérifie que la session est toujours valide en tentant de charger les clients
  const { error } = await supabase.rpc('lister_clients', { p_token: sessionToken });
  if (error) {
    // Session expirée ou invalide -> retour à l'écran de connexion
    sessionToken = null;
    localStorage.removeItem('kaali_session_token');
    localStorage.removeItem('kaali_boutique_nom');
    return;
  }

  demarrerApp();
}

// ============ GESTION DES CLIENTS ============

async function chargerClients() {
  const { data, error } = await supabase.rpc('lister_clients', { p_token: sessionToken });

  if (error) {
    console.error(error);
    if (error.message.includes('Session invalide')) {
      alert('Ta session a expiré, reconnecte-toi.');
      document.getElementById('btn-deconnexion').click();
    }
    return;
  }

  clients = data || [];
  afficherListeClients();
}

function afficherListeClients() {
  const conteneur = document.getElementById('liste-clients');
  conteneur.innerHTML = '';

  if (clients.length === 0) {
    conteneur.innerHTML = '<p class="message-vide">Aucun client pour l\'instant.<br>Ajoute ton premier client débiteur.</p>';
    document.getElementById('total-du').textContent = '0';
    return;
  }

  let totalGeneral = 0;

  clients.forEach(client => {
    const solde = Number(client.solde);
    totalGeneral += solde;

    const carte = document.createElement('div');
    carte.className = 'carte-client';
    carte.innerHTML = `
      <div>
        <div class="carte-client-nom">${client.nom}</div>
        <div class="carte-client-tel">${client.telephone || 'Pas de téléphone'}</div>
      </div>
      <div class="carte-client-solde ${solde <= 0 ? 'zero' : ''}">${solde.toLocaleString('fr-FR')} GNF</div>
    `;
    carte.addEventListener('click', () => ouvrirDetailClient(client));
    conteneur.appendChild(carte);
  });

  document.getElementById('total-du').textContent = totalGeneral.toLocaleString('fr-FR');
}

// ============ MODAL NOUVEAU CLIENT ============

document.getElementById('btn-nouveau-client').addEventListener('click', () => {
  document.getElementById('nouveau-client-nom').value = '';
  document.getElementById('nouveau-client-telephone').value = '';
  document.getElementById('nouveau-client-montant').value = '';
  document.getElementById('modal-nouveau-client').classList.remove('cache');
});

document.getElementById('btn-annuler-client').addEventListener('click', () => {
  document.getElementById('modal-nouveau-client').classList.add('cache');
});

document.getElementById('btn-valider-client').addEventListener('click', async () => {
  const nom = document.getElementById('nouveau-client-nom').value.trim();
  const telephone = document.getElementById('nouveau-client-telephone').value.trim();
  const montant = parseFloat(document.getElementById('nouveau-client-montant').value);

  if (!nom || !montant || montant <= 0) {
    alert('Indique au moins le nom du client et un montant valide.');
    return;
  }

  const { error } = await supabase.rpc('ajouter_client', {
    p_token: sessionToken,
    p_nom: nom,
    p_telephone: telephone || null,
    p_montant: montant
  });

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }

  document.getElementById('modal-nouveau-client').classList.add('cache');
  await chargerClients();
});

// ============ MODAL DETAIL CLIENT ============

async function ouvrirDetailClient(client) {
  clientSelectionne = client;

  document.getElementById('detail-client-nom').textContent = client.nom;
  document.getElementById('detail-client-solde').textContent = Number(client.solde).toLocaleString('fr-FR');

  const { data: transactions, error } = await supabase.rpc('historique_client', {
    p_token: sessionToken,
    p_client_id: client.id
  });

  const historique = document.getElementById('detail-historique');
  historique.innerHTML = '';

  if (!error && transactions) {
    transactions
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .forEach(t => {
        const ligne = document.createElement('div');
        ligne.className = 'ligne-historique';
        const signe = t.type === 'credit' ? '+' : '−';
        const date = new Date(t.created_at).toLocaleDateString('fr-FR');
        ligne.innerHTML = `<span>${date} — ${t.type === 'credit' ? 'Crédit' : 'Paiement'}</span><span>${signe}${Number(t.montant).toLocaleString('fr-FR')}</span>`;
        historique.appendChild(ligne);
      });
  }

  document.getElementById('transaction-montant').value = '';
  document.getElementById('modal-detail-client').classList.remove('cache');
}

document.getElementById('btn-fermer-detail').addEventListener('click', () => {
  document.getElementById('modal-detail-client').classList.add('cache');
});

document.getElementById('btn-valider-transaction').addEventListener('click', async () => {
  const montant = parseFloat(document.getElementById('transaction-montant').value);
  const type = document.getElementById('transaction-type').value;

  if (!montant || montant <= 0) {
    alert('Indique un montant valide.');
    return;
  }

  const { error } = await supabase.rpc('ajouter_transaction', {
    p_token: sessionToken,
    p_client_id: clientSelectionne.id,
    p_type: type,
    p_montant: montant
  });

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }

  document.getElementById('modal-detail-client').classList.add('cache');
  await chargerClients();
});

// ============ RELANCE WHATSAPP ============

document.getElementById('btn-relancer').addEventListener('click', () => {
  if (!clientSelectionne.telephone) {
    alert('Ce client n\'a pas de numéro de téléphone enregistré.');
    return;
  }
  const numeroPropre = clientSelectionne.telephone.replace(/\s|\+/g, '');
  const message = encodeURIComponent(
    `Bonjour ${clientSelectionne.nom}, vous devez ${Number(clientSelectionne.solde).toLocaleString('fr-FR')} GNF à ${boutiqueNom}. Merci de régler dès que possible.`
  );
  window.open(`https://wa.me/${numeroPropre}?text=${message}`, '_blank');
});

// ============ DETECTION HORS LIGNE ============

function mettreAJourIndicateurReseau() {
  if (navigator.onLine) {
    indicateurHorsLigne.classList.add('cache');
  } else {
    indicateurHorsLigne.classList.remove('cache');
  }
}
window.addEventListener('online', () => {
  mettreAJourIndicateurReseau();
  if (sessionToken) chargerClients();
});
window.addEventListener('offline', mettreAJourIndicateurReseau);
mettreAJourIndicateurReseau();

// ============ ENREGISTREMENT SERVICE WORKER (PWA) ============

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW erreur:', err));
  });
}

// ============ DEMARRAGE ============

tenterReconnexionAuto();
