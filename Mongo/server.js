const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const z = require("zod");
const { createServer } = require("node:http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

const server = createServer(app);
const io = new Server(server);

const __dirname2 = path.dirname(__filename);

app.use(express.json());

// Servir les fichiers statiques depuis le répertoire courant
app.use(express.static(__dirname2));

const ProductSchema = z.object({
  _id: z.string(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
  categoryIds: z.array(z.string()),
});
const CreateProductSchema = ProductSchema.omit({ _id: true });

const CategorySchema = z.object({
  _id: z.string(),
  name: z.string(),
});
const CreateCategorySchema = CategorySchema.omit({ _id: true });

// Fonction helper pour récupérer un produit avec ses catégories
async function getProductWithCategories(productId) {
  const result = await db
    .collection("products")
    .aggregate([
      { $match: { _id: new ObjectId(productId) } },
      {
        $lookup: {
          from: "categories",
          localField: "categoryIds",
          foreignField: "_id",
          as: "categories",
        },
      },
    ])
    .toArray();
  
  return result[0] || null;
}

app.post("/products", async (req, res) => {
  const result = await CreateProductSchema.safeParse(req.body);

  if (result.success) {
    const { name, about, price, categoryIds } = result.data;
    const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));

    const ack = await db
      .collection("products")
      .insertOne({ name, about, price, categoryIds: categoryObjectIds });

    const createdProduct = {
      _id: ack.insertedId,
      name,
      about,
      price,
      categoryIds: categoryObjectIds,
    };

    res.send(createdProduct);

    // Récupérer le produit avec ses catégories pour l'événement
    const productWithCategories = await getProductWithCategories(ack.insertedId);
    
    // Émettre l'événement de création
    io.emit('product:created', productWithCategories);
    
    // Garder l'ancien message pour compatibilité
    io.emit(
      "chat message",
      `Created : ${ack.insertedId}, ${name}, ${about}, ${price}, ${categoryObjectIds}`
    );
  } else {
    res.status(400).send(result);
  }
});

app.get("/products", async (req, res) => {
  const result = await db
    .collection("products")
    .aggregate([
      { $match: {} },
      {
        $lookup: {
          from: "categories",
          localField: "categoryIds",
          foreignField: "_id",
          as: "categories",
        },
      },
    ])
    .toArray();

  res.send(result);
});

app.delete("/products/:id", async (req, res) => {
  const { id } = req.params;
  const objectId = new ObjectId(id);
  
  // Récupérer le produit avant suppression pour l'événement
  const productToDelete = await getProductWithCategories(id);
  
  const result = await db
    .collection("products")
    .findOneAndDelete({ _id: objectId }, { returnDocument: "after" });
  
  if (result.value || productToDelete) {
    // Émettre l'événement de suppression
    io.emit('product:deleted', { _id: id, product: productToDelete });
    
    res.send(result.value || { message: "Produit supprimé" });
  } else {
    res.send({ message: "Pas trouvé" });
  }
});

app.patch("/products/:id", async (req, res) => {
  const { id } = req.params;
  const objectId = new ObjectId(id);

  const { name, about, price, categoryIds } = req.body;

  const updates = {};
  if (name) updates.name = name;
  if (about) updates.about = about;
  if (price) updates.price = price;
  if (categoryIds)
    updates.categoryIds = categoryIds.map((id) => new ObjectId(id));

  if (Object.keys(updates).length !== 0) {
    const ack = await db.collection("products").updateOne(
      { _id: objectId },
      {
        $set: {
          ...updates,
        },
      }
    );
    
    const responseData = {
      _id: objectId,
      ...updates,
      modifiedCount: ack.modifiedCount,
    };
    
    res.send(responseData);
    
    // Récupérer le produit mis à jour avec ses catégories pour l'événement
    const updatedProduct = await getProductWithCategories(id);
    
    // Émettre l'événement de mise à jour
    io.emit('product:updated', updatedProduct);
  } else {
    res.status(400).send({ error: "No valid fields to update" });
  }
});

app.put("/products/:id", async (req, res) => {
  const { id } = req.params;
  const objectId = new ObjectId(id);
  const result = await CreateProductSchema.safeParse(req.body);

  if (result.success) {
    const { name, about, price, categoryIds } = result.data;
    const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));
    const ack = await db.collection("products").replaceOne(
      { _id: objectId },
      {
        _id: objectId,
        name,
        about,
        price,
        categoryIds: categoryObjectIds,
      }
    );
    
    const responseData = {
      _id: objectId,
      name,
      about,
      price,
      categoryIds: categoryObjectIds,
      modifiedCount: ack.modifiedCount,
    };
    
    res.send(responseData);
    
    // Récupérer le produit mis à jour avec ses catégories pour l'événement
    const updatedProduct = await getProductWithCategories(id);
    
    // Émettre l'événement de mise à jour
    io.emit('product:updated', updatedProduct);
  } else {
    res.status(400).send(result);
  }
});

app.post("/categories", async (req, res) => {
  const result = await CreateCategorySchema.safeParse(req.body);

  if (result.success) {
    const { name } = result.data;

    const ack = await db.collection("categories").insertOne({ name });

    const createdCategory = { _id: ack.insertedId, name };
    
    res.send(createdCategory);
    
    // Émettre l'événement de création de catégorie
    io.emit('category:created', createdCategory);
  } else {
    res.status(400).send(result);
  }
});

// Route pour récupérer les catégories
app.get("/categories", async (req, res) => {
  const result = await db.collection("categories").find({}).toArray();
  res.send(result);
});

//====================IO
io.on("connection", (socket) => {
  console.log("a user connected");

  socket.broadcast.emit("hi");

  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

client.connect().then(() => {
  db = client.db("ws-db");

  server.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
});