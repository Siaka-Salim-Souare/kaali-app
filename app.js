import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ⚠️ Remplace ces deux valeurs par les tiennes si tu changes de projet Supabase
const SUPABASE_URL = 'https://dohdwtwjqvlbadqwhdev.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KIvEiuKuo9CbtP2TJOGVtw_h_ZpcZXF';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ETAT DE L'APPLICATION ---
let boutiqueActuelle = null; // { id, nom, telephone }
let clients = [];
let clientSelectionne = null;
let transactionsClientSelectionne = [];

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

  const { data, error } = await supabase
    .from('boutiques')
    .select('*')
    .eq('telephone', telephone)
    .eq('pin_code', pin)
    .single();

  if (error || !data) {
    messageErreur.textContent = 'Numéro ou PIN incorrect.';
    return;
  }

  boutiqueActuelle = data;
  localStorage.setItem('kaali_boutique_id', data.id);
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

  const { data, error } = await supabase
    .from('boutiques')
    .insert({ nom, telephone, pin_code: pin })
    .select()
    .single();

  if (error) {
    messageErreur.textContent = error.message.includes('duplicate')
      ? 'Ce numéro est déjà enregistré. Connecte-toi plutôt.'
      : 'Erreur : ' + error.message;
    return;
  }

  boutiqueActuelle = data;
  localStorage.setItem('kaali_boutique_id', data.id);
  demarrerApp();
});

document.getElementById('btn-deconnexion').addEventListener('click', () => {
  localStorage.removeItem('kaali_boutique_id');
  boutiqueActuelle = null;
  ecranPrincipal.classList.add('cache');
  ecranLogin.classList.remove('cache');
});

// ============ DEMARRAGE APP ============

async function demarrerApp() {
  ecranLogin.classList.add('cache');
  ecranPrincipal.classList.remove('cache');
  document.getElementById('nom-boutique-affiche').textContent = boutiqueActuelle.nom;
  await chargerClients();
}

// Reconnexion automatique si déjà connecté précédemment
async function tenterReconnexionAuto() {
  const idSauvegarde = localStorage.getItem('kaali_boutique_id');
  if (!idSauvegarde) return;

  const { data, error } = await supabase
    .from('boutiques')
    .select('*')
    .eq('id', idSauvegarde)
    .single();

  if (data && !error) {
    boutiqueActuelle = data;
    demarrerApp();
  }
}

// ============ GESTION DES CLIENTS ============

async function chargerClients() {
  const { data: clientsData, error } = await supabase
    .from('clients')
    .select('*')
    .eq('boutique_id', boutiqueActuelle.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  clients = clientsData || [];

  // Charger toutes les transactions de la boutique pour calculer les soldes
  const idsClients = clients.map(c => c.id);
  let transactions = [];
  if (idsClients.length > 0) {
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .in('client_id', idsClients);
    transactions = txData || [];
  }

  afficherListeClients(transactions);
}

function calculerSolde(clientId, transactions) {
  return transactions
    .filter(t => t.client_id === clientId)
    .reduce((total, t) => total + (t.type === 'credit' ? t.montant : -t.montant), 0);
}

function afficherListeClients(transactions) {
  const conteneur = document.getElementById('liste-clients');
  conteneur.innerHTML = '';

  if (clients.length === 0) {
    conteneur.innerHTML = '<p class="message-vide">Aucun client pour l\'instant.<br>Ajoute ton premier client débiteur.</p>';
    document.getElementById('total-du').textContent = '0';
    return;
  }

  let totalGeneral = 0;

  clients.forEach(client => {
    const solde = calculerSolde(client.id, transactions);
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
    carte.addEventListener('click', () => ouvrirDetailClient(client, transactions));
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

  const { data: nouveauClient, error } = await supabase
    .from('clients')
    .insert({ boutique_id: boutiqueActuelle.id, nom, telephone: telephone || null })
    .select()
    .single();

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }

  await supabase.from('transactions').insert({
    client_id: nouveauClient.id,
    type: 'credit',
    montant: montant,
    note: 'Crédit initial'
  });

  document.getElementById('modal-nouveau-client').classList.add('cache');
  await chargerClients();
});

// ============ MODAL DETAIL CLIENT ============

async function ouvrirDetailClient(client, transactions) {
  clientSelectionne = client;
  transactionsClientSelectionne = transactions.filter(t => t.client_id === client.id);

  document.getElementById('detail-client-nom').textContent = client.nom;
  const solde = calculerSolde(client.id, transactions);
  document.getElementById('detail-client-solde').textContent = solde.toLocaleString('fr-FR');

  const historique = document.getElementById('detail-historique');
  historique.innerHTML = '';
  transactionsClientSelectionne
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .forEach(t => {
      const ligne = document.createElement('div');
      ligne.className = 'ligne-historique';
      const signe = t.type === 'credit' ? '+' : '−';
      const date = new Date(t.created_at).toLocaleDateString('fr-FR');
      ligne.innerHTML = `<span>${date} — ${t.type === 'credit' ? 'Crédit' : 'Paiement'}</span><span>${signe}${t.montant.toLocaleString('fr-FR')}</span>`;
      historique.appendChild(ligne);
    });

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

  const { error } = await supabase.from('transactions').insert({
    client_id: clientSelectionne.id,
    type: type,
    montant: montant
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
  const solde = calculerSolde(clientSelectionne.id, transactionsClientSelectionne);
  const numeroPropre = clientSelectionne.telephone.replace(/\s|\+/g, '');
  const message = encodeURIComponent(
    `Bonjour ${clientSelectionne.nom}, vous devez ${solde.toLocaleString('fr-FR')} GNF à ${boutiqueActuelle.nom}. Merci de régler dès que possible.`
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
  if (boutiqueActuelle) chargerClients();
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
