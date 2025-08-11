function generateRoutesCode(modelName, includeAuthMiddleware) {
    const middleware = includeAuthMiddleware ? "->middleware('auth')" : "";
    
    return `use App\\Http\\Controllers\\${modelName}Controller;

Route::resource('${modelName.toLowerCase()}s', ${modelName}Controller::class)${middleware};`;
}