export function getHackathonDOStub(
  doNamespace: DurableObjectNamespace,
  hackathonId: string
): DurableObjectStub {
  const id = doNamespace.idFromName(hackathonId);
  return doNamespace.get(id);
}
