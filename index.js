const express = require('express');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/',(req,res)=>{
  res.send('Spark Vault Running')
})


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.3oeok.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// token verification ==============================
  const verifyToken = (req,res,next)=>{
    if(!req.headers.authorization){
      return res.status(401).send({message : 'unauthorize access'})
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
         if(err){
          return res.status(401).send({message : 'unauthorize access'})
         }
         req.decoded = decoded;
         next();
    })
  }
async function run() {
  try {
  
    // await client.connect();

    const productsCollection = client.db('sparkVault').collection('products')
    const likeCollection = client.db('sparkVault').collection('like')
    const reviewCollection = client.db('sparkVault').collection('reviewData')



       // jwt token generate ===============================
    app.post('/jwt',async(req,res)=>{
      const user = req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1d'})
      res.send({token})

    })

    // get products data ==========================
app.get('/product', async (req, res) => {
  const { sortBy, search, page = 1  , limit  } = req.query;

  // Sorting criteria
  let sortCriteria = {};
  if (sortBy === 'timestamp') {
    sortCriteria = { timestamp: -1 };
  } else if (sortBy === 'votes') {
    sortCriteria = { votes: -1 };
  } else {
    sortCriteria = { timestamp: -1 };
  }

  // Filtering criteria
  let filter = {};
  let limitCount = 8;
  if (search) {
    filter = {
      tags: { $elemMatch: { $regex: search, $options: 'i' } },
    };
  }
  if(limit){
   limitCount = parseInt(limit)
  }
  try {
    const skip = (parseInt(page) - 1) * parseInt(limit); // Calculate skip value
    const result = await productsCollection
      .find(filter)
      .sort(sortCriteria)
      .skip(skip) // Skip previous pages
      .limit(limitCount) // Limit results to page size
      .toArray();

    const totalProducts = await productsCollection.countDocuments(filter); // Total products
    res.send({ result, totalProducts });
  } catch (error) {
    res.status(500).send({ message: 'Error fetching products', error });
  }
});
 
//  get one products using id params ==========================
app.get('/product/byId/:id',async(req,res)=>{
  const id = req.params.id;
  const query = {_id : new ObjectId(id)};
  const result = await productsCollection.findOne(query);
  res.send(result);
})

// get review data ==========================
app.get('/review/byId/:id',async(req,res)=>{
  const id = req.params.id;
  const query = {productId : id};
  const result = await reviewCollection.find(query).toArray();
  res.send(result);
})

  // like by user ====================================
app.post('/like', async (req, res) => {
  const newLike = req.body;
  const userEmail = newLike?.liked_by;
  const productId = newLike?.productId;

  if (!userEmail || !productId) {
    return res.status(400).json({ message: 'Invalid request data!' });
  }

  try {
    const filter = { liked_by: userEmail, productId: productId };
    const existingLike = await likeCollection.findOne(filter);

    if (existingLike) {
      // Dislike the product (remove the like)
      await likeCollection.deleteOne(filter);

      // Decrement the vote count in the product collection
      const productFilter = { _id: new ObjectId(productId) };
      const update = { $inc: { votes: -1 } };
      const updateResult = await productsCollection.updateOne(productFilter, update);

      if (updateResult.modifiedCount === 0) {
        return res.status(404).send({ message: 'Product not found!' });
      }

      return res.status(200).send({ message: 'Disliked successfully!' });
    } else {
      // Like the product (add the like)
      await likeCollection.insertOne(newLike);

      // Increment the vote count in the product collection
      const productFilter = { _id: new ObjectId(productId) };
      const update = { $inc: { votes: 1 } };
      const updateResult = await productsCollection.updateOne(productFilter, update);

      if (updateResult.modifiedCount === 0) {
        return res.status(404).send({ message: 'Product not found!' });
      }

      return res.status(201).send({ message: 'Liked successfully!' });
    }
  } catch (error) {
    console.error('Error handling like/dislike:', error);
    res.status(500).send({ message: 'Internal server error!' });
  }
});

// review post ===============================
app.post('/review', async (req, res) => {

    const newReview = req.body;
    const email = newReview.email;
    const productId = newReview.productId;
    const query = { email: email, productId: productId };

    const isExist = await reviewCollection.findOne(query);
    if (isExist) {
      return res.status(409).send({ message: "You have already submitted a review for this product!" });
    }

    const result = await reviewCollection.insertOne(newReview);
    res.status(201).send({ message: "Review submitted successfully!", result });
    res.send(result);
    
});


  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

















app.listen(port,()=>{
  console.log(`My Port is ${port}`)
})