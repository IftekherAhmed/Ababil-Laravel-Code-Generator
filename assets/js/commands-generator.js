function generateCommandsCode(modelName) {
    return `# Migration and Model
php artisan make:migration create_${modelName.toLowerCase()}_table
php artisan make:model ${modelName}

# Controller
php artisan make:controller ${modelName}Controller --resource

# Seeder
php artisan make:seeder ${modelName}Seeder

# API Resource
php artisan make:resource ${modelName}Resource

# Run migrations with seed
php artisan migrate:fresh --seed`;
}