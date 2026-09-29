/** Id casuale per clienti, pagamenti e sessioni manuali. */
export function newId(): string {
  return crypto.randomUUID()
}
