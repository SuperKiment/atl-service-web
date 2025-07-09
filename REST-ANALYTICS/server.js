const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const z = require("zod");
const cors = require("cors");

const app = express();
const port = 3000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());
app.use(cors());

const ViewSchema = z.object({
  source: z.string(),
  url: z.string(),
  visitor: z.string(),
  createdAt: z.date().optional(),
  meta: z.record(z.any()).optional(),
});

const ActionSchema = z.object({
  source: z.string(),
  url: z.string(),
  action: z.string(),
  visitor: z.string(),
  createdAt: z.date().optional(),
  meta: z.record(z.any()).optional(),
});

const GoalSchema = z.object({
  source: z.string(),
  url: z.string(),
  goal: z.string(),
  visitor: z.string(),
  createdAt: z.date().optional(),
  meta: z.record(z.any()).optional(),
});

function processAnalyticsData(data) {
  return {
    ...data,
    createdAt: data.createdAt || new Date(),
    meta: data.meta || {},
  };
}

app.post("/views", async (req, res) => {
  try {
    const result = ViewSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.errors,
      });
    }

    const viewData = processAnalyticsData(result.data);
    const insertResult = await db.collection("views").insertOne(viewData);

    res.status(201).json({
      _id: insertResult.insertedId,
      ...viewData,
    });
  } catch (error) {
    console.error("Error creating view:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/views", async (req, res) => {
  try {
    const {
      source,
      url,
      visitor,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};
    if (source) filter.source = source;
    if (url) filter.url = url;
    if (visitor) filter.visitor = visitor;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const views = await db
      .collection("views")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection("views").countDocuments(filter);

    res.json({
      data: views,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching views:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/views/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const view = await db
      .collection("views")
      .findOne({ _id: new ObjectId(id) });

    if (!view) {
      return res.status(404).json({ error: "View not found" });
    }

    res.json(view);
  } catch (error) {
    console.error("Error fetching view:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/views/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const result = await db
      .collection("views")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "View not found" });
    }

    res.json({ message: "View deleted successfully" });
  } catch (error) {
    console.error("Error deleting view:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/actions", async (req, res) => {
  try {
    const result = ActionSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.errors,
      });
    }

    const actionData = processAnalyticsData(result.data);
    const insertResult = await db.collection("actions").insertOne(actionData);

    res.status(201).json({
      _id: insertResult.insertedId,
      ...actionData,
    });
  } catch (error) {
    console.error("Error creating action:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/actions", async (req, res) => {
  try {
    const {
      source,
      url,
      action,
      visitor,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};
    if (source) filter.source = source;
    if (url) filter.url = url;
    if (action) filter.action = action;
    if (visitor) filter.visitor = visitor;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const actions = await db
      .collection("actions")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection("actions").countDocuments(filter);

    res.json({
      data: actions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching actions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/actions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const action = await db
      .collection("actions")
      .findOne({ _id: new ObjectId(id) });

    if (!action) {
      return res.status(404).json({ error: "Action not found" });
    }

    res.json(action);
  } catch (error) {
    console.error("Error fetching action:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/actions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const result = await db
      .collection("actions")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Action not found" });
    }

    res.json({ message: "Action deleted successfully" });
  } catch (error) {
    console.error("Error deleting action:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/goals", async (req, res) => {
  try {
    const result = GoalSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.errors,
      });
    }

    const goalData = processAnalyticsData(result.data);
    const insertResult = await db.collection("goals").insertOne(goalData);

    res.status(201).json({
      _id: insertResult.insertedId,
      ...goalData,
    });
  } catch (error) {
    console.error("Error creating goal:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/goals", async (req, res) => {
  try {
    const {
      source,
      url,
      goal,
      visitor,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};
    if (source) filter.source = source;
    if (url) filter.url = url;
    if (goal) filter.goal = goal;
    if (visitor) filter.visitor = visitor;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const goals = await db
      .collection("goals")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection("goals").countDocuments(filter);

    res.json({
      data: goals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching goals:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/goals/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const goal = await db
      .collection("goals")
      .findOne({ _id: new ObjectId(id) });

    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json(goal);
  } catch (error) {
    console.error("Error fetching goal:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/goals/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const result = await db
      .collection("goals")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Goal not found" });
    }

    res.json({ message: "Goal deleted successfully" });
  } catch (error) {
    console.error("Error deleting goal:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/analytics/stats", async (req, res) => {
  try {
    const { startDate, endDate, source } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const filter = { ...dateFilter };
    if (source) filter.source = source;

    const [viewsCount, actionsCount, goalsCount] = await Promise.all([
      db.collection("views").countDocuments(filter),
      db.collection("actions").countDocuments(filter),
      db.collection("goals").countDocuments(filter),
    ]);

    const uniqueVisitors = await db
      .collection("views")
      .distinct("visitor", filter);

    res.json({
      views: viewsCount,
      actions: actionsCount,
      goals: goalsCount,
      uniqueVisitors: uniqueVisitors.length,
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/analytics/top-pages", async (req, res) => {
  try {
    const { startDate, endDate, source, limit = 10 } = req.query;

    const matchFilter = {};
    if (startDate || endDate) {
      matchFilter.createdAt = {};
      if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
      if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
    }
    if (source) matchFilter.source = source;

    const topPages = await db
      .collection("views")
      .aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: "$url",
            views: { $sum: 1 },
            uniqueVisitors: { $addToSet: "$visitor" },
          },
        },
        {
          $project: {
            url: "$_id",
            views: 1,
            uniqueVisitors: { $size: "$uniqueVisitors" },
            _id: 0,
          },
        },
        { $sort: { views: -1 } },
        { $limit: parseInt(limit) },
      ])
      .toArray();

    res.json(topPages);
  } catch (error) {
    console.error("Error fetching top pages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/analytics/top-actions", async (req, res) => {
  try {
    const { startDate, endDate, source, limit = 10 } = req.query;

    const matchFilter = {};
    if (startDate || endDate) {
      matchFilter.createdAt = {};
      if (startDate) matchFilter.createdAt.$gte = new Date(startDate);
      if (endDate) matchFilter.createdAt.$lte = new Date(endDate);
    }
    if (source) matchFilter.source = source;

    const topActions = await db
      .collection("actions")
      .aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: "$action",
            count: { $sum: 1 },
            uniqueVisitors: { $addToSet: "$visitor" },
          },
        },
        {
          $project: {
            action: "$_id",
            count: 1,
            uniqueVisitors: { $size: "$uniqueVisitors" },
            _id: 0,
          },
        },
        { $sort: { count: -1 } },
        { $limit: parseInt(limit) },
      ])
      .toArray();

    res.json(topActions);
  } catch (error) {
    console.error("Error fetching top actions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "Analytics API Server",
    endpoints: {
      views: "/views",
      actions: "/actions",
      goals: "/goals",
      analytics: {
        stats: "/analytics/stats",
        topPages: "/analytics/top-pages",
        topActions: "/analytics/top-actions",
      },
    },
  });
});

client
  .connect()
  .then(() => {
    db = client.db("analytics-db");

    db.collection("views").createIndex({ createdAt: -1 });
    db.collection("views").createIndex({ visitor: 1 });
    db.collection("views").createIndex({ source: 1 });
    db.collection("views").createIndex({ url: 1 });

    db.collection("actions").createIndex({ createdAt: -1 });
    db.collection("actions").createIndex({ visitor: 1 });
    db.collection("actions").createIndex({ source: 1 });
    db.collection("actions").createIndex({ action: 1 });

    db.collection("goals").createIndex({ createdAt: -1 });
    db.collection("goals").createIndex({ visitor: 1 });
    db.collection("goals").createIndex({ source: 1 });
    db.collection("goals").createIndex({ goal: 1 });

    app.listen(port, () => {
      console.log(`Analytics API Server listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  });
