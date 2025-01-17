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


const { MongoClient, ServerApiVersion } = require('mongodb');
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




  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

















app.listen(port,()=>{
  console.log(`My Port is ${port}`)
})