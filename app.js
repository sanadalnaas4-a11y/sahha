document.addEventListener('DOMContentLoaded', () => {
    const app = {
        state: {
            rawMaterials: [],
            finishedProducts: [],
            wasteLog: [],
            transactions: [], // The new source of truth for reports
        },

        init() {
            this.loadState();
            this.router.init();
            this.addEventListeners();
            this.renderAll();
            // Set default date for report
            document.getElementById('reportDate').valueAsDate = new Date();
            document.getElementById('reportMonth').value = new Date().toISOString().slice(0, 7);
        },

        saveState() {
            try {
                localStorage.setItem('sahaInventoryState', JSON.stringify(this.state));
            } catch (e) {
                console.error("Error saving state:", e);
                Swal.fire('خطأ', 'لم نتمكن من حفظ بياناتك.', 'error');
            }
        },

        loadState() {
            const storedState = localStorage.getItem('sahaInventoryState');
            if (storedState) {
                try {
                    this.state = JSON.parse(storedState);
                    // Ensure all state arrays exist to prevent errors with old data structures
                    this.state.rawMaterials = this.state.rawMaterials || [];
                    this.state.finishedProducts = this.state.finishedProducts || [];
                    this.state.wasteLog = this.state.wasteLog || [];
                    this.state.transactions = this.state.transactions || [];
                } catch (e) {
                     console.error("Error loading state:", e);
                     this.state = { rawMaterials: [], finishedProducts: [], wasteLog: [], transactions: [] };
                }
            }
        },

        addEventListeners() {
            document.querySelector('.nav-menu').addEventListener('click', e => {
                const link = e.target.closest('a');
                if (link) { e.preventDefault(); this.router.navigateTo(link.hash); }
            });

            document.getElementById('hamburgerBtn').addEventListener('click', () => document.getElementById('sidebar').classList.add('open'));
            document.getElementById('closeBtn').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));

            // Raw Materials
            document.getElementById('addRawMaterialBtn').addEventListener('click', () => this.rawMaterials.add());
            document.getElementById('rawMaterialsSearch').addEventListener('input', (e) => this.render.rawMaterials(e.target.value));
            document.getElementById('rawMaterialsTable').addEventListener('click', e => {
                if (e.target.classList.contains('edit-btn')) this.rawMaterials.edit(e.target.dataset.id);
                if (e.target.classList.contains('delete-btn')) this.rawMaterials.delete(e.target.dataset.id);
            });

            // Finished Products
            document.getElementById('addProductBtn').addEventListener('click', () => this.products.add());
            document.getElementById('finishedProductsSearch').addEventListener('input', (e) => this.render.finishedProducts(e.target.value));
            document.getElementById('finishedProductsTable').addEventListener('click', e => {
                if (e.target.classList.contains('edit-btn')) this.products.edit(e.target.dataset.id);
                if (e.target.classList.contains('delete-btn')) this.products.delete(e.target.dataset.id);
                if (e.target.classList.contains('add-production-btn')) this.products.addProduction(e.target.dataset.id);
            });

            // Sales
            document.getElementById('recordSaleBtn').addEventListener('click', () => this.sales.record());

            // BOM
            document.getElementById('bomProductSelect').addEventListener('change', e => this.bom.showBOMForProduct(e.target.value));
            document.getElementById('addBomItemBtn').addEventListener('click', () => this.bom.add());
            document.getElementById('bomList').addEventListener('click', e => {
                if(e.target.classList.contains('delete-bom-item')) {
                    const { productid, rmid } = e.target.dataset;
                    this.bom.delete(productid, rmid);
                }
            });

            // Waste
            document.getElementById('wasteTypeSelect').addEventListener('change', () => this.waste.updateItemSelect());
            document.getElementById('recordWasteBtn').addEventListener('click', () => this.waste.record());
            
            // Reports
            document.getElementById('reportType').addEventListener('change', this.reports.toggleDateInputs);
            document.getElementById('generateReportBtn').addEventListener('click', () => this.reports.generate());

            // Settings
            document.getElementById('exportDataBtn').addEventListener('click', () => this.settings.exportData());
            document.getElementById('importDataBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
            document.getElementById('importFileInput').addEventListener('change', e => this.settings.importData(e));
            document.getElementById('deleteAllDataBtn').addEventListener('click', () => this.settings.deleteAllData());
            document.getElementById('printReportBtn').addEventListener('click', this.settings.printReport);
        },

        renderAll() {
            this.render.rawMaterials();
            this.render.finishedProducts();
            this.render.bomProductSelect();
            this.render.wasteItemSelect();
            this.render.wasteLog();
            this.render.salesProductSelect();
            this.render.salesLog();
        },
        
        router: {
            pages: document.querySelectorAll('.page'),
            navLinks: document.querySelectorAll('.nav-link'),
            init() {
                const currentHash = window.location.hash || '#rawMaterials';
                this.navigateTo(currentHash);
                window.addEventListener('hashchange', () => this.navigateTo(window.location.hash));
            },
            navigateTo(hash) {
                if(!hash) hash = '#rawMaterials';
                const targetPageId = hash.substring(1) + 'Page';
                
                this.pages.forEach(page => page.classList.toggle('active', page.id === targetPageId));
                this.navLinks.forEach(link => link.classList.toggle('active', link.hash === hash));
                
                document.getElementById('sidebar').classList.remove('open');
                
                if (hash === '#reports') this.reports.generate();
            }
        },

        render: {
            rawMaterials(searchTerm = '') {
                const tableBody = document.getElementById('rawMaterialsTable');
                const filtered = app.state.rawMaterials.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
                tableBody.innerHTML = filtered.length === 0 ? `<tr><td colspan="5" style="text-align:center;">لم يتم إضافة مواد خام بعد.</td></tr>` :
                filtered.map(item => `
                    <tr class="${item.stock <= item.threshold ? 'low-stock' : ''}">
                        <td>${item.name}</td><td>${item.unit}</td><td>${item.stock}</td><td>${item.threshold}</td>
                        <td class="actions">
                            <button class="btn btn-secondary btn-sm edit-btn" data-id="${item.id}">تعديل</button>
                            <button class="btn btn-danger btn-sm delete-btn" data-id="${item.id}">حذف</button>
                        </td>
                    </tr>`).join('');
            },

            finishedProducts(searchTerm = '') {
                const tableBody = document.getElementById('finishedProductsTable');
                const filtered = app.state.finishedProducts.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
                tableBody.innerHTML = filtered.length === 0 ? `<tr><td colspan="4" style="text-align:center;">لم يتم إضافة منتجات جاهزة بعد.</td></tr>` :
                filtered.map(item => `
                    <tr>
                        <td>${item.name}</td><td>${item.unit}</td><td>${item.stock}</td>
                        <td class="actions">
                            <button class="btn btn-success btn-sm add-production-btn" data-id="${item.id}">إضافة إنتاج</button>
                            <button class="btn btn-secondary btn-sm edit-btn" data-id="${item.id}">تعديل</button>
                            <button class="btn btn-danger btn-sm delete-btn" data-id="${item.id}">حذف</button>
                        </td>
                    </tr>`).join('');
            },
            
            salesProductSelect() {
                const select = document.getElementById('salesProductSelect');
                select.innerHTML = '<option value="">-- اختر منتج --</option>' + app.state.finishedProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            },
            
            salesLog() {
                const tableBody = document.getElementById('salesLogTable');
                const salesTransactions = app.state.transactions.filter(t => t.type === 'sale');
                if (salesTransactions.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center;">لا يوجد سجلات مبيعات.</td></tr>`;
                    return;
                }
                tableBody.innerHTML = [...salesTransactions].reverse().map(log => {
                    const item = app.state.finishedProducts.find(i => i.id === log.itemId);
                    return `
                        <tr>
                            <td>${new Date(log.date).toLocaleString('ar-EG')}</td>
                            <td>${item ? item.name : 'منتج محذوف'}</td>
                            <td>${log.quantity}</td>
                        </tr>`;
                }).join('');
            },

            bomProductSelect() {
                const select = document.getElementById('bomProductSelect');
                select.innerHTML = '<option value="">-- اختر منتج --</option>' + app.state.finishedProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            },

            bomList(productId) {
                const product = app.state.finishedProducts.find(p => p.id === productId);
                const listDiv = document.getElementById('bomList');
                if (!product || !product.bom || product.bom.length === 0) {
                    listDiv.innerHTML = '<p>لا توجد مكونات لهذا المنتج.</p>';
                    return;
                }
                listDiv.innerHTML = product.bom.map(item => {
                    const rawMaterial = app.state.rawMaterials.find(rm => rm.id === item.rawMaterialId);
                    return `
                        <div class="bom-item">
                            <span><strong>${rawMaterial ? rawMaterial.name : 'مادة محذوفة'}</strong>: ${item.quantity} ${rawMaterial ? rawMaterial.unit : ''}</span>
                            <button class="btn btn-danger btn-sm delete-bom-item" data-productid="${productId}" data-rmid="${item.rawMaterialId}">&times;</button>
                        </div>
                    `;
                }).join('');
            },

            bomRawMaterialSelect() {
                const select = document.getElementById('bomRawMaterialSelect');
                select.innerHTML = '<option value="">-- اختر مادة خام --</option>' + app.state.rawMaterials.map(rm => `<option value="${rm.id}">${rm.name}</option>`).join('');
            },

            wasteItemSelect(type = 'raw') {
                const select = document.getElementById('wasteItemSelect');
                const items = (type === 'raw') ? app.state.rawMaterials : app.state.finishedProducts;
                select.innerHTML = items.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
            },

            wasteLog() {
                const tableBody = document.getElementById('wasteLogTable');
                if(app.state.wasteLog.length === 0) {
                     tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">لا يوجد سجلات هدر.</td></tr>`;
                     return;
                }
                tableBody.innerHTML = [...app.state.wasteLog].reverse().map(log => {
                    const item = (log.type === 'raw') 
                        ? app.state.rawMaterials.find(i => i.id === log.itemId) 
                        : app.state.finishedProducts.find(i => i.id === log.itemId);
                    return `
                        <tr>
                            <td>${new Date(log.date).toLocaleString('ar-EG')}</td>
                            <td>${log.type === 'raw' ? 'مادة خام' : 'منتج جاهز'}</td>
                            <td>${item ? item.name : 'صنف محذوف'}</td>
                            <td>${log.quantity}</td>
                        </tr>
                    `
                }).join('');
            },
        },

        rawMaterials: {
            async add() {
                const { value: formValues } = await Swal.fire({
                    title: 'إضافة مادة خام جديدة',
                    html: `
                        <input id="swal-name" class="swal2-input" placeholder="اسم المادة" required>
                        <input id="swal-unit" class="swal2-input" placeholder="وحدة القياس (مثال: قطعة, لتر)">
                        <input id="swal-stock" type="number" class="swal2-input" placeholder="الكمية الأولية" value="0" min="0">
                        <input id="swal-threshold" type="number" class="swal2-input" placeholder="حد التنبيه (الكمية الأدنى)" value="0" min="0">
                    `,
                    focusConfirm: false,
                    confirmButtonText: 'إضافة',
                    cancelButtonText: 'إلغاء',
                    showCancelButton: true,
                    preConfirm: () => {
                        const name = document.getElementById('swal-name').value;
                        if (!name) {
                            Swal.showValidationMessage(`اسم المادة مطلوب`);
                            return false;
                        }
                        return {
                            name: name,
                            unit: document.getElementById('swal-unit').value,
                            stock: parseFloat(document.getElementById('swal-stock').value) || 0,
                            threshold: parseFloat(document.getElementById('swal-threshold').value) || 0,
                        }
                    }
                });

                if (formValues) {
                    app.state.rawMaterials.push({ id: `rm_${Date.now()}`, ...formValues });
                    app.saveState();
                    app.render.rawMaterials();
                    app.render.bomRawMaterialSelect();
                    Swal.fire('تم!', 'تمت إضافة المادة الخام بنجاح.', 'success');
                }
            },
            async edit(id) {
                const item = app.state.rawMaterials.find(i => i.id === id);
                if (!item) return;
                
                const { value: formValues } = await Swal.fire({
                    title: 'تعديل مادة خام',
                    html: `
                        <input id="swal-name" class="swal2-input" placeholder="اسم المادة" value="${item.name}" required>
                        <input id="swal-unit" class="swal2-input" placeholder="وحدة القياس" value="${item.unit}">
                        <input id="swal-stock" type="number" class="swal2-input" placeholder="الكمية الحالية" value="${item.stock}" min="0">
                        <input id="swal-threshold" type="number" class="swal2-input" placeholder="حد التنبيه" value="${item.threshold}" min="0">
                    `,
                    focusConfirm: false,
                    confirmButtonText: 'حفظ التعديلات',
                    cancelButtonText: 'إلغاء',
                    showCancelButton: true,
                    preConfirm: () => {
                        const name = document.getElementById('swal-name').value;
                        if (!name) {
                            Swal.showValidationMessage(`اسم المادة مطلوب`);
                            return false;
                        }
                        return {
                            name: name,
                            unit: document.getElementById('swal-unit').value,
                            stock: parseFloat(document.getElementById('swal-stock').value) || 0,
                            threshold: parseFloat(document.getElementById('swal-threshold').value) || 0,
                        }
                    }
                });

                if (formValues) {
                    Object.assign(item, formValues);
                    app.saveState();
                    app.render.rawMaterials();
                    Swal.fire('تم!', 'تم تحديث المادة الخام بنجاح.', 'success');
                }
            },
            delete(id) {
                Swal.fire({
                    title: 'هل أنت متأكد؟',
                    text: "سيتم حذف هذه المادة الخام نهائيًا!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'نعم، احذفه!',
                    cancelButtonText: 'إلغاء'
                }).then((result) => {
                    if (result.isConfirmed) {
                        app.state.rawMaterials = app.state.rawMaterials.filter(i => i.id !== id);
                        app.state.finishedProducts.forEach(p => {
                           if(p.bom) p.bom = p.bom.filter(b => b.rawMaterialId !== id);
                        });
                        app.saveState();
                        app.render.rawMaterials();
                        app.render.bomRawMaterialSelect();
                        Swal.fire('تم الحذف!', 'تم حذف المادة الخام.', 'success');
                    }
                });
            }
        },

        products: {
            async add() {
                const { value: formValues } = await Swal.fire({
                    title: 'إضافة منتج جاهز جديد',
                    html: `
                        <input id="swal-name" class="swal2-input" placeholder="اسم المنتج" required>
                        <input id="swal-unit" class="swal2-input" placeholder="وحدة القياس (مثال: كرتونة, عبوة)">
                        <input id="swal-stock" type="number" class="swal2-input" placeholder="الكمية الأولية" value="0" min="0">
                    `,
                    focusConfirm: false,
                    confirmButtonText: 'إضافة',
                    cancelButtonText: 'إلغاء',
                    showCancelButton: true,
                    preConfirm: () => {
                        const name = document.getElementById('swal-name').value;
                        if (!name) {
                            Swal.showValidationMessage(`اسم المنتج مطلوب`);
                            return false;
                        }
                        return {
                            name: name,
                            unit: document.getElementById('swal-unit').value,
                            stock: parseFloat(document.getElementById('swal-stock').value) || 0,
                        }
                    }
                });

                if (formValues) {
                    app.state.finishedProducts.push({ id: `fp_${Date.now()}`, bom: [], ...formValues });
                    app.saveState();
                    app.render.finishedProducts();
                    app.render.bomProductSelect();
                    app.render.salesProductSelect();
                    Swal.fire('تم!', 'تمت إضافة المنتج بنجاح.', 'success');
                }
            },
            async edit(id) {
                 const item = app.state.finishedProducts.find(i => i.id === id);
                if (!item) return;
                
                const { value: formValues } = await Swal.fire({
                    title: 'تعديل منتج جاهز',
                    html: `
                        <input id="swal-name" class="swal2-input" placeholder="اسم المنتج" value="${item.name}" required>
                        <input id="swal-unit" class="swal2-input" placeholder="وحدة القياس" value="${item.unit}">
                        <input id="swal-stock" type="number" class="swal2-input" placeholder="الكمية الحالية" value="${item.stock}" min="0">
                    `,
                    focusConfirm: false,
                    confirmButtonText: 'حفظ التعديلات',
                    cancelButtonText: 'إلغاء',
                    showCancelButton: true,
                    preConfirm: () => {
                        const name = document.getElementById('swal-name').value;
                        if (!name) {
                            Swal.showValidationMessage(`اسم المنتج مطلوب`);
                            return false;
                        }
                        return {
                            name: name,
                            unit: document.getElementById('swal-unit').value,
                            stock: parseFloat(document.getElementById('swal-stock').value) || 0,
                        }
                    }
                });

                if (formValues) {
                    Object.assign(item, { ...item, ...formValues });
                    app.saveState();
                    app.render.finishedProducts();
                    Swal.fire('تم!', 'تم تحديث المنتج بنجاح.', 'success');
                }
            },
            delete(id) {
                Swal.fire({
                    title: 'هل أنت متأكد؟',
                    text: "سيتم حذف هذا المنتج نهائيًا!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'نعم، احذفه!',
                    cancelButtonText: 'إلغاء'
                }).then((result) => {
                    if (result.isConfirmed) {
                        app.state.finishedProducts = app.state.finishedProducts.filter(i => i.id !== id);
                        app.saveState();
                        app.render.finishedProducts();
                        app.render.bomProductSelect();
                        app.render.salesProductSelect();
                        Swal.fire('تم الحذف!', 'تم حذف المنتج.', 'success');
                    }
                })
            },
            async addProduction(productId) {
                const product = app.state.finishedProducts.find(p => p.id === productId);
                if (!product) return;
                if (!product.bom || product.bom.length === 0) {
                    Swal.fire('خطأ', 'لا يمكن الإنتاج. لم يتم تعريف مكونات (BOM) لهذا المنتج.', 'error');
                    return;
                }

                const { value: qty } = await Swal.fire({
                    title: `إنتاج ${product.name}`,
                    input: 'number',
                    inputLabel: `أدخل الكمية المراد إنتاجها`,
                    inputPlaceholder: 'مثال: 50',
                    showCancelButton: true,
                    confirmButtonText: 'بدء الإنتاج',
                    cancelButtonText: 'إلغاء',
                    inputValidator: (value) => {
                        if (!value || value <= 0) { return 'الرجاء إدخال كمية صحيحة!' }
                    }
                });

                if (qty) {
                    const quantity = parseFloat(qty);
                    let canProduce = true;
                    const rawMaterialsUsed = [];

                    for (const item of product.bom) {
                        const rawMaterial = app.state.rawMaterials.find(rm => rm.id === item.rawMaterialId);
                        const required = item.quantity * quantity;
                        if (!rawMaterial || rawMaterial.stock < required) {
                            canProduce = false;
                            Swal.fire('نقص في المخزون!', `لا توجد كمية كافية من "${rawMaterial.name}". المطلوب: ${required}, المتاح: ${rawMaterial.stock}.`, 'warning');
                            break;
                        }
                        rawMaterialsUsed.push({ rawMaterialId: item.rawMaterialId, quantity: required });
                    }
                    
                    if (canProduce) {
                        rawMaterialsUsed.forEach(used => {
                            const rawMaterial = app.state.rawMaterials.find(rm => rm.id === used.rawMaterialId);
                            rawMaterial.stock -= used.quantity;
                        });
                        product.stock += quantity;

                        app.state.transactions.push({
                            id: `t_${Date.now()}`, date: new Date().toISOString(), type: 'production',
                            itemId: productId, quantity: quantity, rawMaterialsUsed: rawMaterialsUsed
                        });

                        app.saveState();
                        app.render.rawMaterials();
                        app.render.finishedProducts();
                        Swal.fire('تم الإنتاج!', `تمت إضافة ${quantity} من ${product.name}.`, 'success');
                    }
                }
            }
        },
        sales: {
            record() {
                const productId = document.getElementById('salesProductSelect').value;
                const quantity = parseFloat(document.getElementById('salesQty').value);
                
                if (!productId || !quantity || quantity <= 0) {
                    Swal.fire('خطأ', 'الرجاء اختيار منتج وإدخال كمية صحيحة.', 'error');
                    return;
                }

                const product = app.state.finishedProducts.find(p => p.id === productId);
                if (!product || product.stock < quantity) {
                    Swal.fire('خطأ في المخزون', `الكمية المطلوبة (${quantity}) أكبر من المتاح (${product ? product.stock : 0}).`, 'error');
                    return;
                }

                product.stock -= quantity;
                
                app.state.transactions.push({
                    id: `t_${Date.now()}`, date: new Date().toISOString(), type: 'sale',
                    itemId: productId, quantity: quantity
                });

                app.saveState();
                app.render.finishedProducts();
                app.render.salesLog();
                document.getElementById('salesQty').value = '';
                document.getElementById('salesProductSelect').value = '';
                Swal.fire('تم البيع!', `تم خصم ${quantity} من ${product.name}.`, 'success');
            }
        },
        bom: {
            showBOMForProduct(productId) {
                const bomDetailsDiv = document.getElementById('bomDetails');
                if (!productId) {
                    bomDetailsDiv.classList.add('hidden');
                    return;
                }
                const product = app.state.finishedProducts.find(p => p.id === productId);
                document.getElementById('bomProductName').textContent = product.name;
                app.render.bomList(productId);
                app.render.bomRawMaterialSelect();
                bomDetailsDiv.classList.remove('hidden');
            },
            add() {
                const productId = document.getElementById('bomProductSelect').value;
                const rawMaterialId = document.getElementById('bomRawMaterialSelect').value;
                const quantity = parseFloat(document.getElementById('bomRawMaterialQty').value);
                
                if (!productId || !rawMaterialId || !quantity || quantity <= 0) {
                    Swal.fire('خطأ', 'الرجاء اختيار منتج ومادة خام وإدخال كمية صحيحة.', 'error');
                    return;
                }

                const product = app.state.finishedProducts.find(p => p.id === productId);
                if (!product.bom) product.bom = [];

                const existingItem = product.bom.find(item => item.rawMaterialId === rawMaterialId);
                if(existingItem) {
                    existingItem.quantity = quantity;
                } else {
                    product.bom.push({ rawMaterialId, quantity });
                }
                
                app.saveState();
                app.render.bomList(productId);
                document.getElementById('bomRawMaterialQty').value = '';
                Swal.fire('تم!', 'تمت إضافة/تحديث المادة للمكونات بنجاح.', 'success');
            },
            delete(productId, rawMaterialId) {
                const product = app.state.finishedProducts.find(p => p.id === productId);
                if (product && product.bom) {
                    product.bom = product.bom.filter(item => item.rawMaterialId !== rawMaterialId);
                    app.saveState();
                    app.render.bomList(productId);
                }
            }
        },
        waste: {
            updateItemSelect() {
                const type = document.getElementById('wasteTypeSelect').value;
                app.render.wasteItemSelect(type);
            },
            record() {
                const type = document.getElementById('wasteTypeSelect').value;
                const itemId = document.getElementById('wasteItemSelect').value;
                const quantity = parseFloat(document.getElementById('wasteQty').value);

                if(!itemId || !quantity || quantity <= 0) {
                    Swal.fire('خطأ', 'الرجاء اختيار صنف وإدخال كمية صحيحة.', 'error');
                    return;
                }

                const items = (type === 'raw') ? app.state.rawMaterials : app.state.finishedProducts;
                const item = items.find(i => i.id === itemId);

                if (!item || item.stock < quantity) {
                     Swal.fire('خطأ', `الكمية المفقودة أكبر من الكمية المتاحة في المخزون (${item.stock}).`, 'error');
                    return;
                }

                item.stock -= quantity;
                app.state.wasteLog.push({
                    id: `w_${Date.now()}`,
                    date: new Date().toISOString(),
                    type,
                    itemId,
                    quantity
                });

                app.saveState();
                if(type === 'raw') app.render.rawMaterials(); else app.render.finishedProducts();
                app.render.wasteLog();
                document.getElementById('wasteQty').value = '';
                 Swal.fire('تم التسجيل!', 'تم تسجيل الهدر وخصمه من المخزون.', 'success');
            }
        },
        reports: {
            toggleDateInputs() {
                const type = document.getElementById('reportType').value;
                const dateInput = document.getElementById('reportDate');
                const monthInput = document.getElementById('reportMonth');
                if (type === 'daily') {
                    dateInput.classList.remove('hidden');
                    dateInput.previousElementSibling.classList.remove('hidden');
                    monthInput.classList.add('hidden');
                    monthInput.previousElementSibling.classList.add('hidden');
                } else {
                    dateInput.classList.add('hidden');
                    dateInput.previousElementSibling.classList.add('hidden');
                    monthInput.classList.remove('hidden');
                    monthInput.previousElementSibling.classList.remove('hidden');
                }
            },
            generate() {
                const type = document.getElementById('reportType').value;
                const dateVal = document.getElementById('reportDate').value;
                const monthVal = document.getElementById('reportMonth').value;
                const outputDiv = document.getElementById('textReportOutput');

                if ((type === 'daily' && !dateVal) || (type === 'monthly' && !monthVal)) {
                    outputDiv.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">الرجاء اختيار تاريخ صالح لعرض التقرير.</p>`;
                    return;
                }

                let startDate, endDate;
                if (type === 'daily') {
                    startDate = new Date(dateVal);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(dateVal);
                    endDate.setHours(23, 59, 59, 999);
                } else {
                    const [year, month] = monthVal.split('-');
                    startDate = new Date(year, month - 1, 1);
                    endDate = new Date(year, month, 0, 23, 59, 59, 999);
                }
                
                const transactionsInPeriod = app.state.transactions.filter(t => {
                    const tDate = new Date(t.date);
                    return tDate >= startDate && tDate <= endDate;
                });
                
                let reportHTML = `<h3>تقرير ${type === 'daily' ? 'يومي' : 'شهري'} للفترة من ${startDate.toLocaleDateString('ar-EG')} إلى ${endDate.toLocaleDateString('ar-EG')}</h3>`;

                // Finished Products and Sales Report
                let productsSection = `<div class="report-section"><h3>1. قسم الإنتاج الجاهز والمبيعات</h3>`;
                app.state.finishedProducts.forEach(product => {
                    const productions = transactionsInPeriod.filter(t => t.type === 'production' && t.itemId === product.id);
                    const sales = transactionsInPeriod.filter(t => t.type === 'sale' && t.itemId === product.id);
                    const totalProduction = productions.reduce((sum, t) => sum + t.quantity, 0);
                    const totalSales = sales.reduce((sum, t) => sum + t.quantity, 0);
                    
                    const closingBalance = product.stock;
                    const openingBalance = closingBalance - totalProduction + totalSales;

                    productsSection += `
                        <div class="report-item">
                            <h4>المنتج: ${product.name}</h4>
                            <p>الرصيد الافتتاحي: <strong>${openingBalance.toFixed(2)} ${product.unit || ''}</strong></p>
                            <p>الإنتاج الجديد: <strong style="color:var(--success-color)">+ ${totalProduction.toFixed(2)} ${product.unit || ''}</strong></p>
                            <p>المجموع قبل المبيعات: <strong>${(openingBalance + totalProduction).toFixed(2)} ${product.unit || ''}</strong></p>
                            <p>المبيعات: <strong style="color:var(--danger-color)">- ${totalSales.toFixed(2)} ${product.unit || ''}</strong></p>
                            <p>الرصيد الختامي: <strong>${closingBalance.toFixed(2)} ${product.unit || ''}</strong></p>
                        </div>`;
                });
                productsSection += `</div>`;
                reportHTML += productsSection;

                // Raw Materials Report
                let rawMaterialsSection = `<div class="report-section"><h3>2. قسم المواد الخام</h3>`;
                app.state.rawMaterials.forEach(rm => {
                    let totalUsed = 0;
                    transactionsInPeriod.forEach(t => {
                        if (t.type === 'production' && t.rawMaterialsUsed) {
                            const used = t.rawMaterialsUsed.find(usedRm => usedRm.rawMaterialId === rm.id);
                            if (used) totalUsed += used.quantity;
                        }
                    });

                    const closingBalance = rm.stock;
                    const openingBalance = closingBalance + totalUsed;
                    
                    rawMaterialsSection += `
                        <div class="report-item">
                            <h4>المادة الخام: ${rm.name}</h4>
                            <p>الرصيد الافتتاحي: <strong>${openingBalance.toFixed(2)} ${rm.unit || ''}</strong></p>
                            <p>المستخدم في الإنتاج: <strong style="color:var(--danger-color)">- ${totalUsed.toFixed(2)} ${rm.unit || ''}</strong></p>
                            <p>الرصيد الختامي: <strong>${closingBalance.toFixed(2)} ${rm.unit || ''}</strong></p>
                        </div>`;
                });
                rawMaterialsSection += `</div>`;
                reportHTML += rawMaterialsSection;

                outputDiv.innerHTML = reportHTML;
            }
        },
        settings: {
            exportData() {
                const dataStr = JSON.stringify(app.state, null, 2);
                const dataBlob = new Blob([dataStr], {type: "application/json"});
                const dataUrl = URL.createObjectURL(dataBlob);
                const exportFileDefaultName = `saha_inventory_backup_${new Date().toISOString().slice(0,10)}.json`;
                const linkElement = document.createElement('a');
                linkElement.href = dataUrl;
                linkElement.download = exportFileDefaultName;
                document.body.appendChild(linkElement);
                linkElement.click();
                document.body.removeChild(linkElement);
                URL.revokeObjectURL(dataUrl);
                Swal.fire('تم!', 'جاري تحميل ملف النسخة الاحتياطية.', 'success');
            },
            importData(event) {
                const file = event.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const newState = JSON.parse(e.target.result);
                        if ('rawMaterials' in newState && 'finishedProducts' in newState) {
                            Swal.fire({
                                title: 'تأكيد الاستيراد',
                                text: "سيتم استبدال جميع البيانات الحالية بالبيانات الموجودة في الملف. هل أنت متأكد؟",
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonText: 'نعم، استورد البيانات!',
                                cancelButtonText: 'إلغاء'
                            }).then((result) => {
                                if (result.isConfirmed) {
                                    app.state = newState;
                                    app.saveState();
                                    app.renderAll();
                                    Swal.fire('نجاح!', 'تم استيراد البيانات بنجاح.', 'success');
                                }
                            });
                        } else { throw new Error('Invalid file format'); }
                    } catch (error) {
                         Swal.fire('خطأ', 'الملف غير صالح أو تالف.', 'error');
                    } finally {
                        event.target.value = '';
                    }
                };
                reader.readAsText(file);
            },
            deleteAllData() {
                 Swal.fire({
                    title: 'هل أنت متأكد تمامًا؟',
                    html: `هذا الإجراء سيحذف <b>كل شيء</b> نهائيًا.<br>اكتب "حذف" للتأكيد.`,
                    icon: 'error',
                    input: 'text',
                    inputAttributes: { autocapitalize: 'off' },
                    showCancelButton: true,
                    confirmButtonText: 'تأكيد الحذف',
                    cancelButtonText: 'إلغاء',
                    preConfirm: (value) => {
                        if (value !== 'حذف') {
                            Swal.showValidationMessage('الرجاء كتابة "حذف" بشكل صحيح للتأكيد.');
                        }
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        app.state = { rawMaterials: [], finishedProducts: [], wasteLog: [], transactions: [] };
                        app.saveState();
                        app.renderAll();
                        Swal.fire('تم الحذف!', 'تم حذف جميع البيانات بنجاح.', 'success');
                    }
                });
            },
            async printReport() {
                const { jsPDF } = window.jspdf;
                const reportContent = document.getElementById('textReportOutput');
                const originalBackgroundColor = reportContent.style.backgroundColor;
                reportContent.style.backgroundColor = 'white';

                const canvas = await html2canvas(reportContent, { scale: 2, useCORS: true });
                reportContent.style.backgroundColor = originalBackgroundColor;

                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'pt',
                    format: [canvas.width, canvas.height]
                });
                
                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save(`report_${new Date().toISOString().slice(0,10)}.pdf`);
            }
        },
    };
    
    window.app = app;
    app.init();
});
