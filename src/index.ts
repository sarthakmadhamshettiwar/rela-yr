import express, { Request, Response } from 'express';
const dotenv = require('dotenv');
dotenv.config();
const PORT = process.env.PORT;
console.log(PORT);