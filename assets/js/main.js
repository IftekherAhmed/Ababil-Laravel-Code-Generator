$(document).ready(function() {
    // Auto-generate table name from model name (lowercase)
    $('#modelName').on('input', function() {
        const modelName = $(this).val();
        const tableNameInput = $('#tableName');
        
        // Only auto-update if table name hasn't been manually modified
        if (!tableNameInput.data('modified')) {
            tableNameInput.val(modelName ? modelName.toLowerCase() : '');
        }
    });

    // Track manual modifications to table name
    $('#tableName').on('input', function() {
        $(this).data('modified', $(this).val().length > 0);
    });

    // Add new field
    $('#addFieldBtn').click(function() {
        const newField = $('#fieldTemplate').clone().removeAttr('id').show();
        $('#fieldsContainer').append(newField);
        
        // Initialize event handlers for the new field
        initFieldHandlers(newField);
    });

    // Initialize event handlers for a field
    function initFieldHandlers(field) {        
        // Field name select handler
        field.find('.field-name-select').change(function() {
            const selectedValue = $(this).val();
            const nameInput = field.find('.field-name-input');
            
            if (selectedValue === 'custom') {
                nameInput.toggle().focus().val('');
            } else {
                nameInput.hide().val(selectedValue);
            }
        });
    
        // Trigger change to set initial state
        field.find('.field-name-select').trigger('change');

        // Field name select handler
        field.find('.field-type').change(function() {
            const type = $(this).val();
            const optionsContainer = field.find('.options-container');
            
            // Reset all options
            optionsContainer.find('> div').hide();
            
            // Show relevant options based on type
            if (type === 'string' || type === 'decimal') {
                field.find('.length-option').toggle();
            }
            
            if (type === 'enum') {
                field.find('.enum-options').toggle();
            }
            
            if (type === 'file') {
                field.find('.file-options').toggle();
            }
            
            if (type === 'relation') {
                field.find('.relation-options').toggle();
                
                // Auto-generate foreign key in lowercase with '_id' suffix
                field.find('.related-model').off('input').on('input', function() {
                    const relatedModel = $(this).val();
                    const foreignKeyInput = field.find('.foreign-key');
                    
                    if (relatedModel && !foreignKeyInput.data('modified')) {
                        foreignKeyInput.val(relatedModel.toLowerCase() + '_id');
                    }
                });
                
                // Track manual modifications to foreign key
                field.find('.foreign-key').on('input', function() {
                    $(this).data('modified', $(this).val().length > 0);
                });
            } else {
                // Clear and hide relation fields when switching away from relation type
                field.find('.relation-options').hide();
                field.find('.related-model').val('').data('modified', false);
                field.find('.foreign-key').val('').data('modified', false);
                field.find('.on-delete-null').prop('checked', true);
                field.find('.on-delete-cascade').prop('checked', false);
            }
        });
        
        // Default value checkbox handler
        field.find('.default-check').change(function() {
            field.find('.default-value-container').toggle($(this).is(':checked'));
        });
        
        // Cast checkbox handler
        field.find('.cast-check').change(function() {
            field.find('.cast-options').toggle($(this).is(':checked'));
        });
        
        // Remove field handler
        field.find('.remove-field-btn').click(function() {
            $(this).closest('.field-container').remove();
        });
        
        // Trigger change to set initial state
        field.find('.field-type').trigger('change');
        field.find('.default-check').trigger('change');
        field.find('.cast-check').trigger('change');
    }

    // Form submission
    $('#modelGeneratorForm').submit(function(e) {
        e.preventDefault();
        
        const modelName = $('#modelName').val();
        if (!modelName) {
            alert('Please enter a model name');
            return;
        }
        
        const tableName = $('#tableName').val() || modelName.toLowerCase();
        const modelNamespace = $('#modelNamespace').val();
        const controllerNamespace = $('#controllerNamespace').val();
        const baseController = $('#baseController').val();
        const includeSoftDeletes = $('#softDeletes').is(':checked');
        const includeAuthMiddleware = $('#authMiddleware').is(':checked');
        
        const fields = [];
        const modelRelations = [];
        
        $('.field-container').each(function() {
            const fieldName = $(this).find('.field-name-input').val();
            if (!fieldName) return true; // skip if no name
            
            const fieldType = $(this).find('.field-type').val();
            
            if (fieldType === 'relation') {
                const relationshipType = $(this).find('.relationship-type').val();
                const relatedModel = $(this).find('.related-model').val();
                const foreignKey = $(this).find('.foreign-key').val();
                const onDeleteNull = $(this).find('.on-delete-null').is(':checked');
                const onDeleteCascade = $(this).find('.on-delete-cascade').is(':checked');
                
                // Only include belongsTo in fields array for migrations/controllers
                if (relationshipType === 'belongsTo') {
                    fields.push({
                        name: foreignKey || relatedModel.toLowerCase() + '_id',
                        type: 'relation',
                        relationshipType: 'belongsTo',
                        relatedModel: relatedModel,
                        foreignKey: foreignKey,
                        onDeleteNull: onDeleteNull,
                        onDeleteCascade: onDeleteCascade,
                        nullable: $(this).find('.nullable-check').is(':checked'),
                        hasDefault: $(this).find('.default-check').is(':checked'),
                        defaultValue: $(this).find('.default-value').val()
                    });
                }
                
                // Always store relationship for model generation
                modelRelations.push({
                    name: fieldName,
                    type: 'relation',
                    relationshipType: relationshipType,
                    relatedModel: relatedModel,
                    foreignKey: foreignKey,
                    onDeleteNull: onDeleteNull,
                    onDeleteCascade: onDeleteCascade
                });
            } else {
                // Regular field processing
                fields.push({
                    name: fieldName,
                    type: fieldType,
                    nullable: $(this).find('.nullable-check').is(':checked'),
                    unique: $(this).find('.unique-check').is(':checked'),
                    index: $(this).find('.index-check').is(':checked'),
                    hasDefault: $(this).find('.default-check').is(':checked'),
                    defaultValue: $(this).find('.default-value').val(),
                    length: $(this).find('.field-length').val(),
                    precision: $(this).find('.field-precision').val(),
                    enumValues: $(this).find('.enum-values').val(),
                    allowedTypes: $(this).find('.allowed-types').val(),
                    filePath: $(this).find('.file-path').val(),
                    maxFileSize: $(this).find('.max-file-size').val(),
                    fillable: $(this).find('.fillable-check').is(':checked'),
                    cast: $(this).find('.cast-check').is(':checked'),
                    castType: $(this).find('.cast-type').val()
                });
            }
        });
        
        if (fields.length === 0) {
            alert('Please add at least one field');
            return;
        }
        
        // Generate code - use fields for migration/controller, include modelRelations in model
        const migrationCode = generateMigrationCode(modelName, tableName, fields, includeSoftDeletes);
        const modelCode = generateModelCode(modelName, modelNamespace, [...fields, ...modelRelations], includeSoftDeletes);
        const controllerCode = generateControllerCode(
            modelName, 
            tableName, 
            modelNamespace, 
            controllerNamespace, 
            baseController, 
            fields, 
            includeAuthMiddleware
        );
        const seederCode = generateSeederCode(modelName, fields);
        const resourceCode = generateResourceCode(modelName, fields);
        const routesCode = generateRoutesCode(modelName, includeAuthMiddleware);
        const commandsCode = generateCommandsCode(modelName);
        
        // Display the generated code
        $('#migrationCode').text(migrationCode);
        $('#modelCode').text(modelCode);
        $('#controllerCode').text(controllerCode);
        $('#seederCode').text(seederCode);
        $('#resourceCode').text(resourceCode);
        $('#routesCode').text(routesCode);
        $('#commandsCode').text(commandsCode);
        
        // Show the output
        $('#codeOutput').show();
        
        // Re-highlight syntax
        document.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    });

    // Copy button functionality
    $(document).on('click', '.copy-btn', function() {
        const target = $(this).data('target');
        const code = $(target).text();
        navigator.clipboard.writeText(code).then(() => {
            const originalText = $(this).html();
            $(this).html('<i class="bi bi-check"></i> Copied!');
            setTimeout(() => {
                $(this).html(originalText);
            }, 2000);
        });
    });

    // Download button functionality
    $(document).on('click', '.download-btn', function() {
        const target = $(this).data('target');
        const filename = $(this).data('filename');
        const code = $(target).text();
        
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename + '.php';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Copy all button
    $('#copyAllBtn').click(function() {
        let allCode = '// Migration\n' + $('#migrationCode').text() + '\n\n';
        allCode += '// Model\n' + $('#modelCode').text() + '\n\n';
        allCode += '// Controller\n' + $('#controllerCode').text();
        
        navigator.clipboard.writeText(allCode).then(() => {
            const originalText = $(this).html();
            $(this).html('<i class="bi bi-check"></i> All Copied!');
            setTimeout(() => {
                $(this).html(originalText);
            }, 2000);
        });
    });

    // Download all button
    $('#downloadAllBtn').click(async function() {
        const $btn = $(this);
        const originalHtml = $btn.html();
        
        try {
            // Show loading state
            $btn.prop('disabled', true).html('<i class="bi bi-arrow-repeat spinner"></i> Processing...');
            
            // Verify JSZip is loaded
            if (typeof JSZip === 'undefined') {
                throw new Error('JSZip library failed to load. Please refresh the page.');
            }
            
            const modelName = $('#modelName').val() || 'laravel_model';
            const zip = new JSZip();
            
            // Create proper folder structure
            const migrations = zip.folder('database/migrations');
            const models = zip.folder('app/Models');
            const controllers = zip.folder('app/Http/Controllers');
            const resources = zip.folder('app/Http/Resources');
            const seeders = zip.folder('database/seeders');
            const routesFolder = zip.folder('routes');
            
            // Add files with proper timestamps for migrations
            const now = new Date();
            const timestamp = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
            
            migrations.file(`${timestamp}_create_${modelName.toLowerCase()}_table.php`, $('#migrationCode').text());
            models.file(`${modelName}.php`, $('#modelCode').text());
            controllers.file(`${modelName}Controller.php`, $('#controllerCode').text());
            resources.file(`${modelName}Resource.php`, $('#resourceCode').text());
            seeders.file(`${modelName}Seeder.php`, $('#seederCode').text());
            routesFolder.file('web.php', `<?php\n\n${$('#routesCode').text()}`);
            
            // Generate the zip file
            const content = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });
            
            // Create download link
            const a = document.createElement('a');
            const url = URL.createObjectURL(content);
            
            a.href = url;
            a.download = `${modelName}_files.zip`;
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                $btn.html('<i class="bi bi-check-circle"></i> Success!');
                setTimeout(() => $btn.html(originalHtml).prop('disabled', false), 2000);
            }, 100);
            
        } catch (error) {
            console.error('Download error:', error);
            alert(`Download failed: ${error.message}`);
            $btn.html(originalHtml).prop('disabled', false);
        }
    });

    // Add the first field by default
    $('#addFieldBtn').click();
});