export async function lookupPatientHash(givenId: string): Promise<{ hash: string; name: string }> {
  const key = process.env.PLATO_API_KEY;
  const db = process.env.PLATO_DB;

  // Direct lookup by ID
  const resp = await fetch(
    `https://clinic.platomedical.com/api/${db}/patient/${givenId}`,
    { headers: { Authorization: `Bearer ${key}` } }
  );

  if (!resp.ok) throw new Error("Plato lookup failed: " + resp.status);

  const data = await resp.json();
  const patient = Array.isArray(data) ? data[0] : data;

  if (!patient || !patient._id) throw new Error("Patient not found: " + givenId);

  console.log("Plato resolved:", givenId, "->", patient._id, patient.name);
  return { hash: patient._id, name: patient.name || "Patient" };
}
