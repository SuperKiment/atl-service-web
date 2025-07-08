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
  reviewIds: z.array(z.string()).optional(),
  averageScore: z.number().min(0).max(5).optional(),
});
const CreateProductSchema = ProductSchema.omit({ id: true, reviewIds: true, averageScore: true });

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Le mot de passe doit faire au moins 8 caractères"),
});
const CreateUserSchema = UserSchema.omit({ id: true });

const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  productIds: z.array(z.string()),
  total: z.number().min(0),
  payment: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
const CreateOrderSchema = OrderSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  total: true,
});

const ReviewSchema = z.object({
  id: z.string(),
  userId: z.string(),
  productId: z.string(),
  score: z.number().min(1).max(5),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
const CreateReviewSchema = ReviewSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

//ROUTES PRODUIT
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/products", async (req, res) => {
  const queryName = req.query.name || "";
  const queryAbout = req.query.about || "";
  const queryPrice = req.query.price || 9999999999;
  const products = await sql`SELECT * FROM products WHERE name ILIKE ${
    "%" + queryName + "%"
  } AND about ILIKE ${"%" + queryAbout + "%"} AND price < ${queryPrice};`;
  res.send(products);
});

app.get("/product/:id", async (req, res) => {
  try {
    const product = await sql`SELECT * FROM products WHERE id = ${req.params.id};`;

    if (product.length === 0) {
      return res.status(404).send({
        error: "Pas trouvé le produit",
      });
    }

    // Récupérer les reviews complètes pour ce produit
    const reviews = await sql`
      SELECT 
        r.id,
        r.user_id,
        r.product_id,
        r.score,
        r.content,
        r.created_at,
        r.updated_at,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email
        ) as user
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ${req.params.id}
      ORDER BY r.created_at DESC;
    `;

    const productWithReviews = {
      ...product[0],
      reviews: reviews
    };

    res.send(productWithReviews);
  } catch (error) {
    console.error('Erreur lors de la récupération du produit:', error);
    res.status(500).send({ error: "Erreur serveur" });
  }
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

//ROUTES F2P GAMES
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

//ROUTES ORDERS
// GET tous les orders
app.get("/orders", async (req, res) => {
  try {
    const orders = await sql`
      SELECT 
        o.id,
        o.user_id,
        o.product_ids,
        o.total,
        o.payment,
        o.created_at,
        o.updated_at,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email
        ) as user
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC;
    `;

    // Pour chaque order, récupérer les produits complets
    const ordersWithProducts = await Promise.all(
      orders.map(async (order) => {
        const products = await sql`
          SELECT * FROM products 
          WHERE id = ANY(${order.product_ids});
        `;
        return {
          ...order,
          products: products
        };
      })
    );

    res.send(ordersWithProducts);
  } catch (error) {
    console.error('Erreur lors de la récupération des commandes:', error);
    res.status(500).send({ error: "Erreur serveur" });
  }
});

app.get("/order/:id", async (req, res) => {
  try {
    const order = await sql`
      SELECT 
        o.id,
        o.user_id,
        o.product_ids,
        o.total,
        o.payment,
        o.created_at,
        o.updated_at,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email
        ) as user
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ${req.params.id};
    `;

    if (order.length === 0) {
      return res.status(404).send({
        error: "Pas trouvé la commande",
      });
    }

    // Récupérer les produits complets
    const products = await sql`
      SELECT * FROM products 
      WHERE id = ANY(${order[0].product_ids});
    `;

    const orderWithProducts = {
      ...order[0],
      products: products
    };

    res.send(orderWithProducts);
  } catch (error) {
    console.error('Erreur lors de la récupération de la commande:', error);
    res.status(500).send({ error: "Erreur serveur" });
  }
});

app.post("/order", async (req, res) => {
  try {
    const result = await CreateOrderSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).send({
        error: "Données invalides",
        details: result.error.errors
      });
    }

    const { userId, productIds, payment = false } = result.data;

    // Vérifier que l'utilisateur existe
    const userExists = await sql`SELECT id FROM users WHERE id = ${userId};`;
    if (userExists.length === 0) {
      return res.status(404).send({
        error: "Utilisateur non trouvé",
      });
    }

    // Récupérer les prix des produits pour calculer le total
    const products = await sql`
      SELECT price FROM products 
      WHERE id = ANY(${productIds});
    `;

    if (products.length !== productIds.length) {
      return res.status(400).send({
        error: "Certains produits n'existent pas",
      });
    }

    // Calculer le total avec TVA (20%)
    const subtotal = products.reduce((sum, product) => sum + product.price, 0);
    const total = subtotal * 1.2;

    const now = new Date();
    const order = await sql`
      INSERT INTO orders (user_id, product_ids, total, payment, created_at, updated_at)
      VALUES (${userId}, ${productIds}, ${total}, ${payment}, ${now}, ${now})
      RETURNING *;
    `;

    console.log("Commande créée avec l'id : ", order[0].id);
    res.status(201).send(order[0]);
  } catch (error) {
    console.error('Erreur lors de la création de la commande:', error);
    res.status(500).send({ error: "Erreur serveur" });
  }
});

app.put("/order/:id", async (req, res) => {
  try {
    const result = await CreateOrderSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).send({
        error: "Données invalides",
        details: result.error.errors
      });
    }

    const { userId, productIds, payment = false } = result.data;

    // Vérifier que l'utilisateur existe
    const userExists = await sql`SELECT id FROM users WHERE id = ${userId};`;
    if (userExists.length === 0) {
      return res.status(404).send({
        error: "Utilisateur non trouvé",
      });
    }

    // Récupérer les prix des produits pour recalculer le total
    const products = await sql`
      SELECT price FROM products 
      WHERE id = ANY(${productIds});
    `;

    if (products.length !== productIds.length) {
      return res.status(400).send({
        error: "Certains produits n'existent pas",
      });
    }

    // Calculer le total avec TVA (20%)
    const subtotal = products.reduce((sum, product) => sum + product.price, 0);
    const total = subtotal * 1.2;

    const now = new Date();
    const order = await sql`
      UPDATE orders
      SET user_id = ${userId}, product_ids = ${productIds}, total = ${total}, payment = ${payment}, updated_at = ${now}
      WHERE id = ${req.params.id}
      RETURNING *;
    `;

    if (order.length === 0) {
      return res.status(404).send({
        error: "Pas trouvé la commande à mettre à jour",
      });
    }

    res.send(order[0]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la commande:', error);
    res.status(500).send({ error: "Erreur serveur" });
  }
});

app.patch("/order/:id", async (req, res) => {
  try {
    const result = await CreateOrderSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).send({
        error: "Données invalides",
        details: result.error.errors
      });
    }

    const { userId, productIds, payment } = req.body;
    const updates = {};
    const now = new Date();

    if (userId) {
      // Vérifier que l'utilisateur existe
      const userExists = await sql`SELECT id FROM users WHERE id = ${userId};`;
      if (userExists.length === 0) {
        return res.status(404).send({
          error: "Utilisateur non trouvé",
        });
      }
      updates.user_id = userId;
    }

    if (productIds) {
      // Vérifier que les produits existent et recalculer le total
      const products = await sql`
        SELECT price FROM products 
        WHERE id = ANY(${productIds});
      `;

      if (products.length !== productIds.length) {
        return res.status(400).send({
          error: "Certains produits n'existent pas",
        });
      }

      const subtotal = products.reduce((sum, product) => sum + product.price, 0);
      const total = subtotal * 1.2;

      updates.product_ids = productIds;
      updates.total = total;
    }

    if (payment !== undefined) {
      updates.payment = payment;
    }

    updates.updated_at = now;

    const order = await sql`
      UPDATE orders
      SET ${sql(updates)}
      WHERE id = ${req.params.id}
      RETURNING *;
    `;

    if (order.length === 0) {
      return res.status(404).send({
        error: "Pas trouvé la commande à mettre à jour",
      });
    }

    res.send(order[0]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour partielle de la commande:', error);
    res.status(500).send({ error: "Erreur serveur" });
  }
});

app.delete("/order/:id", async (req, res) => {
  try {
    const order = await sql`
      DELETE FROM orders 
      WHERE id = ${req.params.id} 
      RETURNING *;
    `;

    if (order.length === 0) {
      return res.status(404).send({
        error: "Pas trouvé la commande à supprimer",
      });
    }

    console.log("Commande supprimée avec l'id : ", order[0].id);
    res.send(order[0]);
  } catch (error) {
    console.error('Erreur lors de la suppression de la commande:', error);
    res.status(500).send({ error: "Erreur serveur" });
  }
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});