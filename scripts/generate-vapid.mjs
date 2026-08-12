/**
 * Gera um par de chaves VAPID (Web Push) usando apenas o crypto do Node.
 *
 * Uso:
 *   node scripts/generate-vapid.mjs
 *
 * Saída:
 *   PUBLIC:  <chave pública em base64url>  (vai para o app / subscription)
 *   PRIVATE: <chave privada em base64url>  (vai para os secrets da Edge Function)
 */
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

// Chave pública VAPID = ponto não-comprimido de 65 bytes (começa com 0x04)
const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
const pubPoint = spkiDer.subarray(spkiDer.length - 65);

// Chave privada VAPID = componente "d" (32 bytes) do JWK
const jwk = privateKey.export({ format: 'jwk' });
const privRaw = Buffer.from(jwk.d, 'base64url');

const b64url = (buf) => Buffer.from(buf).toString('base64url');

console.log('PUBLIC:  ' + b64url(pubPoint));
console.log('PRIVATE: ' + b64url(privRaw));
