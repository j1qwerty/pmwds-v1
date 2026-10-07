const base = "http://localhost:5179/api/v1";
for (const email of ["superadmin@org1.com", "admin@org1.com", "manager@org1.com"]) {
  const r = await fetch(`${base}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: process.env.E2E_PASSWORD }),
  });
  const t = await r.text();
  console.log(`${email} -> ${r.status} ${t.slice(0, 160).replace(/\s+/g, " ")}`);
}
