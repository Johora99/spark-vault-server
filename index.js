const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;

app.use(cors());

app.get('/',(req,res)=>{
  res.send('Spark Vault Running')
})
app.listen(port,()=>{
  console.log(`My Port is ${port}`)
})