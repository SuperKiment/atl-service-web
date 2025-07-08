const express = require("express");
const postgres = require("postgres");
const z = require("zod");
const bcrypt = require("bcrypt");

const app = express();
const port = 8000;

const sql = postgres({
  db: "rest-db",
  user: "postgres",
  password: "Tonnerre,55",
});

app.use(express.json());

//============SCHEMA
const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
});
const CreateProductSchema = ProductSchema.omit({ id: true });

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Le mot de passe doit faire au moins 8 caractères"),
});
const CreateUserSchema = UserSchema.omit({ id: true });

//ROUTES PRODUIT
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/products", async (req, res) => {
  const products = await sql`SELECT * FROM products;`;
  res.send(products);
});

app.get("/product/:id", async (req, res) => {
  const product =
    await sql`SELECT * FROM products WHERE id = ${req.params.id};`;

  if (product.length === 0) {
    return res.status(404).send({
      error: "Pas trouvé le produit",
    });
  }

  res.send(product[0]);
});

app.post("/product", async (req, res) => {
  const result = await CreateProductSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).send({
      error: "Nope manque des trucs !!",
    });
  }

  const { name, about, price } = result.data;

  const product =
    await sql`INSERT INTO products (name, about, price) VALUES (${name}, ${about}, ${price}) RETURNING *;`;
  console.log("id inséré : ", product[0].id);

  res.send(product[0]);
});

app.delete("/product", async (req, res) => {
  if (!req.body.id) {
    return res.status(400).send({
      error: "Nope manque des trucs !!",
    });
  }

  const product =
    await sql`DELETE FROM products WHERE id = ${req.body.id} RETURNING *;`;

  if (product.length === 0) {
    return res.status(404).send({
      error: "Pas trouvé le produit à supprimer",
    });
  }

  console.log("id supprimé : ", product[0].id);
  res.send(product[0]);
});

//ROUTES USER
app.post("/user", async (req, res) => {
  const result = await CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).send({
      error: "Nope manque des trucs !!",
    });
  }
  const { name, email, password } = result.data;

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await sql`
        INSERT INTO users (name, email, password)
        VALUES (${name}, ${email}, ${hashedPassword})
        RETURNING email, name, id;
    `;

  res.send(user[0]);
});

app.put("/user/:id", async (req, res) => {
  const result = await CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).send({
      error: "Nope manque des trucs !!",
    });
  }

  const { name, email, password } = result.data;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await sql`
        UPDATE users
        SET name = ${name}, email = ${email}, password = ${hashedPassword}
        WHERE id = ${req.params.id}
        RETURNING email, name, id;
    `;
  if (user.length === 0) {
    return res.status(404).send({
      error: "Pas trouvé l'utilisateur à mettre à jour",
    });
  }
  res.send(user[0]);
});

app.patch("/user/:id", async (req, res) => {
  const result = await CreateUserSchema.partial().safeParse(req.body);
  if (!result.success) {
    return res.status(400).send({
      error: "Nope manque des trucs !!",
    });
  }

  const { name, email, password } = req.body;

  const updates = {};
  if (name) updates.name = name;
  if (email) updates.email = email;
  if (password) updates.password = await bcrypt.hash(password, 10);

  const user = await sql`
            UPDATE users
            SET ${sql(updates)}
            WHERE id = ${req.params.id}
            RETURNING email, name, id;
        `;
  if (user.length === 0) {
    return res.status(404).send({
      error: "Pas trouvé l'utilisateur à mettre à jour partiellement",
    });
  }
  res.send(user[0]);
});

app.get("/f2p-games", async (req, res) => {
  const response = await fetch("https://www.freetogame.com/api/games");
  const games = await response.json();
  res.send(games);
});

app.get("/f2p-games/:id", async (req, res) => {
  const response = await fetch(
    `https://www.freetogame.com/api/game?id=${req.params.id}`
  );
  const game = await response.json();
  if (!game.id) {
    return res.status(404).send({
      error: "Pas trouvé le jeu",
    });
  }
  res.send(game);
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
