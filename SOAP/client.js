const soap = require("soap");

soap.createClient(
  "http://localhost:8000/products?wsdl",
  {},
  function (err, client) {
    if (err) {
      console.error("Error creating SOAP client:", err);
      return;
    }

    client.CreateProduct({ name: "ordi", price: 2700, about:"bon ordi" }, function (err, result) {
      if (err) {
        console.error(
          "Error making SOAP request:",
          err.response.status,
          err.response.statusText,
          err.body
        );
        return;
      }
      console.log("Result:", result);
    });
  }
);
