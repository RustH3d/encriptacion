cipher
======

Simple ciphering function derived from Google's crypto.js AES encryption function.

## Interface
````
/*require the cipher module, and pass it a secret
This secret should be an environmental variable if used in production.
The secret MUST be the same in across everything that uses the module
*/
var cipher = require('./cipher.js')("fishingEagleHippieHatFrisbee");

//Just an example message to be encrypted
var exampleMessage = "911-emergency-token";

//scramble it by passing it to cipher.encrypt
var scrambledMessage = cipher.encrypt(exampleMessage);

//some crazy hash object, only console.logging the keys 'cause it's long
console.log(Object.keys(scrambledToken));

//unscramble it by passing the scrambled object to cipher.decrypt
var unscrambledToken = cipher.decrypt(scrambledToken);
console.log(unscrambledToken); //"911-emergency-token"
````

#### It's that easy to use. 'Nuff said =)
