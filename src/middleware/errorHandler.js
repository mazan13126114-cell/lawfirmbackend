

// =======================
// Not Found Handler
// =======================
//    Handle 404 errors for routes that do not exist

const notFound = (req, res, next) => {
  // Create a new error object with the requested URL
  const error = new Error(`Not Found - ${req.originalUrl}`);

  // Set HTTP status to 404 (Not Found)
  res.status(404);

  // Pass error to global error handler
  next(error);
};

// =======================
// Global Error Handler
// =======================
//    Handle all errors thrown in routes/middlewares

const errorHandler = (err, req, res, next) => {
  // Default to 500 if response status is still 200
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // =======================
  // Prisma client errors mapping
  // PrismaClientKnownRequestError contains codes for constraint violations etc.
  if (err.name === 'PrismaClientKnownRequestError') {
    // Unique constraint violation
    if (err.code === 'P2002') {
      statusCode = 400;
      message = 'Unique constraint failed';
      if (err.meta && err.meta.target) message = `${err.meta.target.join(', ')} already exists`;
    }
    // Foreign key constraint or record not found
    else if (err.code === 'P2003') {
      statusCode = 400;
      message = 'Invalid reference to related record';
    } else {
      statusCode = 400;
      message = err.message;
    }
  }

  // Prisma validation or runtime errors
  if (err.name === 'PrismaClientValidationError' || err.name === 'PrismaClientUnknownRequestError') {
    statusCode = 400;
    message = err.message;
  }

  // =======================
  // JWT Errors
  // =======================
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401; // Unauthorized
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // =======================
  // Development Logging
  // =======================
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err); // Full error object
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message: message,
    // Include stack trace and full error in development mode for debugging
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      error: err 
    })
  });
};

module.exports = {
  notFound,
  errorHandler
};
