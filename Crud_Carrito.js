require('dotenv').config(); 

const express = require('express');
const sql = require('mssql');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(bodyParser.json());
app.use(cors());

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// Conexión a SQL Server
sql.connect(dbConfig)
  .then(() => console.log('Conexión al servidor exitosa'))
  .catch(err => console.error('Hubo un error al conectar al servidor:', err));

  // POST /carrito - Agregar o actualizar producto
  app.post('/carrito', async (req, res) => {
    try {
      const { productoId, cantidad } = req.body;
  
      // Validar existencia del producto
      const pool = await sql.connect(dbConfig);
      const productoCheck = await pool.request()
        .input('productoId', sql.Char(10), productoId)
        .query('SELECT ID FROM Productos WHERE ID = @productoId');
  
      if (productoCheck.recordset.length === 0) {
        return res.status(404).send('Producto no encontrado');
      }
  
      // Verificar si el producto ya está en el carrito
      const itemExistente = await pool.request()
        .input('productoId', sql.Char(10), productoId)
        .query('SELECT ProductoID FROM Carrito WHERE ProductoID = @productoId');
  
      if (itemExistente.recordset.length > 0) {
        // Actualizar cantidad si ya existe
        await pool.request()
          .input('productoId', sql.Char(10), productoId)
          .input('cantidad', sql.Int, cantidad || 1)
          .query(`
            UPDATE Carrito 
            SET Cantidad = Cantidad + @cantidad 
            WHERE ProductoID = @productoId
          `);
      } else {
        // Insertar nuevo producto
        await pool.request()
          .input('productoId', sql.Char(10), productoId)
          .input('cantidad', sql.Int, cantidad || 1)
          .query(`
            INSERT INTO Carrito (ProductoID, Cantidad)
            VALUES (@productoId, @cantidad)
          `);
      }
  
      res.status(201).json({
        message: "Producto agregado/actualizado en el carrito",
        productoId
      });
  
    } catch (err) {
      res.status(500).send(`Error al procesar el carrito: ${err.message}`);
    }
  });
  
  // GET /carrito - Obtener todos los productos del carrito
  app.get('/carrito', async (req, res) => {
    try {
      const pool = await sql.connect(dbConfig);
      const result = await pool.request().query(`
        SELECT 
          P.ID AS ProductoID,
          P.Nombre,
          P.Precio AS PrecioUnitario,
          C.Cantidad,
          (P.Precio * C.Cantidad) AS TotalLinea,
          CONVERT(varchar, C.FechaAgregado, 120) AS FechaAgregado
        FROM Carrito C
        INNER JOIN Productos P ON C.ProductoID = P.ID
      `);
      res.json(result.recordset);
    } catch (err) {
      res.status(500).send(err.message);
    }
  });
  
  // PUT /carrito/:id - Actualizar cantidad de un producto dependiendo de su ID
  app.put('/carrito/:productoId', async (req, res) => {
    try {
      const { productoId } = req.params;
      const { cantidad } = req.body;
  
      const pool = await sql.connect(dbConfig);
      const result = await pool.request()
        .input('productoId', sql.Char(10), productoId)
        .input('cantidad', sql.Int, cantidad)
        .query(`
          UPDATE Carrito 
          SET Cantidad = @cantidad 
          WHERE ProductoID = @productoId
        `);
  
      if (result.rowsAffected[0] === 0) {
        return res.status(404).send('Producto no encontrado en el carrito');
      }
  
      res.json({
        message: "Cantidad actualizada",
        productoId,
        nuevaCantidad: cantidad
      });
  
    } catch (err) {
      res.status(500).send(`Error actualizando cantidad: ${err.message}`);
    }
  });
  
  // DELETE /carrito/:id - Eliminar item dependiendo de su ID
  app.delete('/carrito/:productoId', async (req, res) => {
    try {
      const { productoId } = req.params;
      const pool = await sql.connect(dbConfig);
      const result = await pool.request()
        .input('productoId', sql.Char(10), productoId)
        .query('DELETE FROM Carrito WHERE ProductoID = @productoId');
  
      if (result.rowsAffected[0] === 0) {
        return res.status(404).send('Producto no encontrado en el carrito');
      }
  
      res.json({
        message: "Producto eliminado del carrito",
        productoId
      });
  
    } catch (err) {
      res.status(500).send(`Error eliminando producto: ${err.message}`);
    }
  });
  
  // DELETE /carrito - Eliminar todo lo del carrito
  app.delete('/carrito', async (req, res) => {
    try {
      const pool = await sql.connect(dbConfig);
      await pool.request().query('DELETE FROM Carrito');
      res.json({ message: "Carrito vaciado exitosamente" });
    } catch (err) {
      res.status(500).send(`Error vaciando carrito: ${err.message}`);
    }
  });
  
  // Iniciar servidor
  app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
  });
