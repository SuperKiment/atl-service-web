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

// Plus besoin de route spécifique pour "/", express.static s'en occupe
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname2, "index.html"));
// });

app.post("/products", async (req, res) => {
  const result = await CreateProductSchema.safeParse(req.body);

  if (result.success) {
    const { name, about, price, categoryIds } = result.data;
    const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));

    const ack = await db
      .collection("products")
      .insertOne({ name, about, price, categoryIds: categoryObjectIds });

    res.send({
      _id: ack.insertedId,
      name,
      about,
      price,
      categoryIds: categoryObjectIds,
    });

    io.emit("product_created", {
      _id: ack.insertedId,
      name,
      about,
      price,
      categoryIds: categoryObjectIds,
    });
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
  const result = await db
    .collection("products")
    .findOneAndDelete({ _id: objectId }, { returnDocument: "after" });
  res.send(result || { message: "Pas trouvé" });
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
    res.send({
      _id: objectId,
      ...updates,
      modifiedCount: ack.modifiedCount,
    });
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
    res.send({
      _id: objectId,
      name,
      about,
      price,
      categoryIds: categoryObjectIds,
      modifiedCount: ack.modifiedCount,
    });
  } else {
    res.status(400).send(result);
  }
});

app.post("/categories", async (req, res) => {
  const result = await CreateCategorySchema.safeParse(req.body);

  if (result.success) {
    const { name } = result.data;

    const ack = await db.collection("categories").insertOne({ name });

    res.send({ _id: ack.insertedId, name });
  } else {
    res.status(400).send(result);
  }
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
