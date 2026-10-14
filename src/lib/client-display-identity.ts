import { decryptClientData } from '@/lib/db-encryption';

type ClientDisplayIdentityInput = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

export function formatClientDisplayIdentity(input: ClientDisplayIdentityInput) {
  const decrypted = decryptClientData({
    firstName: input.firstName || '',
    lastName: input.lastName || '',
  });
  const firstName = String(decrypted.firstName || '').trim();
  const lastName = String(decrypted.lastName || '').trim();
  const clientName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown Client';

  return {
    client_name: clientName,
    client_email: input.email,
  };
}

/** Decrypted display name for a stored (possibly encrypted) first and last name. */
export function decryptClientName(firstName: string | null | undefined, lastName: string | null | undefined) {
  const decrypted = decryptClientData({ firstName: firstName || '', lastName: lastName || '' });
  const first = String(decrypted.firstName || '').trim();
  const last = String(decrypted.lastName || '').trim();
  return { firstName: first, lastName: last, fullName: [first, last].filter(Boolean).join(' ') };
}
