export async function lookupPatientHash(givenId: string): Promise<{ hash: string; name: string }> {
  const key = process.env.PLATO_API_KEY;
  const db = process.env.PLATO_DB;

  const resp = await fetch(
    `https://clinic.platomedical.com/api/${db}/patient?search=${givenId}`,
    { headers: { Authorization: `Bearer ${key}` } }
  );

  if (!resp.ok) throw new Error("Plato lookup failed: " + resp.status);

  const patients = await resp.json();
  const match = patients.find((p: any) => p.given_id === givenId);

  if (!match) throw new Error("Patient not found: " + givenId);

  return { hash: match._id, name: match.name || "Patient" };
}
