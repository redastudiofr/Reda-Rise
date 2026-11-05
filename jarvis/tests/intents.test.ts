import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEcho, parseIntent, sentences } from '../src/lib/intents';

test('commandes vocales', () => {
  assert.deepEqual(parseIntent('Répète'), { kind: 'repeat' });
  assert.deepEqual(parseIntent('Jarvis, répète s’il te plaît'), { kind: 'repeat' });
  assert.deepEqual(parseIntent('passe'), { kind: 'skip' });
  assert.deepEqual(parseIntent('Suivant.'), { kind: 'skip' });
  assert.deepEqual(parseIntent('Détaille le point 3'), { kind: 'detail', point: 3 });
  assert.deepEqual(parseIntent('détaille-moi le point deux'), { kind: 'detail', point: 2 });
  assert.deepEqual(parseIntent('Développe le premier point'), { kind: 'detail', point: 1 });
  assert.deepEqual(parseIntent('Lis-moi le mail de Karim'), { kind: 'readMail', from: 'karim' });
  assert.deepEqual(parseIntent("lis moi le dernier mail d'Amazon"), { kind: 'readMail', from: 'amazon' });
  assert.deepEqual(parseIntent('Lis-moi le message de la société Colissimo'), { kind: 'readMail', from: 'colissimo' });
  assert.equal(parseIntent('oui').kind, 'free', 'sans planning affiché, oui reste libre');
  assert.deepEqual(parseIntent('Oui, je confirme', true), { kind: 'confirm' });
  assert.deepEqual(parseIntent('non annule', true), { kind: 'cancel' });
  assert.deepEqual(parseIntent('Je dois faire du sport et la compta'), { kind: 'free', text: 'Je dois faire du sport et la compta' });
  assert.equal(parseIntent('Le passé simple').kind, 'free', 'pas de faux « passe »');
});

test('écho de sa propre voix', () => {
  const said = "L'actualité d'hier, en 3 points. Premier point : le budget 2027 est présenté.";
  assert.equal(isEcho('le budget 2027 est présenté', said), true);
  assert.equal(isEcho('détaille le point deux', said), false);
  assert.equal(isEcho('passe', said), false);
});

test('découpage en phrases', () => {
  const long = 'Une phrase. ' + 'Mot, '.repeat(80) + 'fin. Dernière.';
  const parts = sentences(long, 120);
  assert.ok(parts.every((p) => p.length <= 130), parts.map((p) => p.length).join());
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), long.replace(/\s+/g, ' ').trim());
});
