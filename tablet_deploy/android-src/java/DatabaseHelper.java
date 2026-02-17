package app.lovable.toplavanderia;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.Log;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * HELPER DO BANCO DE DADOS LOCAL
 * 
 * Gerencia o banco de dados SQLite para operações, máquinas e configurações
 * Sistema híbrido: funciona offline e sincroniza quando online
 */
public class DatabaseHelper extends SQLiteOpenHelper {
    private static final String TAG = "DatabaseHelper";
    
    // Versão do banco
    private static final int DATABASE_VERSION = 1;
    private static final String DATABASE_NAME = "TopLavanderia.db";
    
    // Tabelas
    private static final String TABLE_MACHINES = "machines";
    private static final String TABLE_OPERATIONS = "operations";
    private static final String TABLE_SETTINGS = "settings";
    private static final String TABLE_SYNC_QUEUE = "sync_queue";
    
    // Colunas das máquinas
    private static final String COL_MACHINE_ID = "id";
    private static final String COL_MACHINE_NAME = "name";
    private static final String COL_MACHINE_TYPE = "type"; // LAVAR, SECAR
    private static final String COL_MACHINE_STATUS = "status"; // LIVRE, OCUPADA, MANUTENCAO
    private static final String COL_MACHINE_PRICE = "price";
    private static final String COL_MACHINE_DURATION = "duration"; // minutos
    private static final String COL_MACHINE_CREATED = "created_at";
    private static final String COL_MACHINE_UPDATED = "updated_at";
    
    // Colunas das operações
    private static final String COL_OPERATION_ID = "id";
    private static final String COL_OPERATION_MACHINE_ID = "machine_id";
    private static final String COL_OPERATION_SERVICE = "service";
    private static final String COL_OPERATION_PRICE = "price";
    private static final String COL_OPERATION_STATUS = "status"; // PENDENTE, PAGO, CANCELADO, FINALIZADO
    private static final String COL_OPERATION_PAYMENT_CODE = "payment_code";
    private static final String COL_OPERATION_TRANSACTION_ID = "transaction_id";
    private static final String COL_OPERATION_START_TIME = "start_time";
    private static final String COL_OPERATION_END_TIME = "end_time";
    private static final String COL_OPERATION_CREATED = "created_at";
    private static final String COL_OPERATION_SYNCED = "synced";
    
    // Colunas das configurações
    private static final String COL_SETTING_KEY = "key";
    private static final String COL_SETTING_VALUE = "value";
    private static final String COL_SETTING_UPDATED = "updated_at";
    
    // Colunas da fila de sincronização
    private static final String COL_SYNC_ID = "id";
    private static final String COL_SYNC_TABLE = "table_name";
    private static final String COL_SYNC_ACTION = "action"; // INSERT, UPDATE, DELETE
    private static final String COL_SYNC_DATA = "data";
    private static final String COL_SYNC_CREATED = "created_at";
    
    public DatabaseHelper(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }
    
    @Override
    public void onCreate(SQLiteDatabase db) {
        Log.d(TAG, "Criando banco de dados...");
        
        // Tabela de máquinas
        String CREATE_MACHINES_TABLE = "CREATE TABLE " + TABLE_MACHINES + "("
                + COL_MACHINE_ID + " INTEGER PRIMARY KEY AUTOINCREMENT,"
                + COL_MACHINE_NAME + " TEXT NOT NULL,"
                + COL_MACHINE_TYPE + " TEXT NOT NULL,"
                + COL_MACHINE_STATUS + " TEXT DEFAULT 'LIVRE',"
                + COL_MACHINE_PRICE + " REAL NOT NULL,"
                + COL_MACHINE_DURATION + " INTEGER NOT NULL,"
                + COL_MACHINE_CREATED + " DATETIME DEFAULT CURRENT_TIMESTAMP,"
                + COL_MACHINE_UPDATED + " DATETIME DEFAULT CURRENT_TIMESTAMP"
                + ")";
        
        // Tabela de operações
        String CREATE_OPERATIONS_TABLE = "CREATE TABLE " + TABLE_OPERATIONS + "("
                + COL_OPERATION_ID + " INTEGER PRIMARY KEY AUTOINCREMENT,"
                + COL_OPERATION_MACHINE_ID + " INTEGER NOT NULL,"
                + COL_OPERATION_SERVICE + " TEXT NOT NULL,"
                + COL_OPERATION_PRICE + " REAL NOT NULL,"
                + COL_OPERATION_STATUS + " TEXT DEFAULT 'PENDENTE',"
                + COL_OPERATION_PAYMENT_CODE + " TEXT,"
                + COL_OPERATION_TRANSACTION_ID + " TEXT,"
                + COL_OPERATION_START_TIME + " DATETIME,"
                + COL_OPERATION_END_TIME + " DATETIME,"
                + COL_OPERATION_CREATED + " DATETIME DEFAULT CURRENT_TIMESTAMP,"
                + COL_OPERATION_SYNCED + " INTEGER DEFAULT 0,"
                + "FOREIGN KEY(" + COL_OPERATION_MACHINE_ID + ") REFERENCES " + TABLE_MACHINES + "(" + COL_MACHINE_ID + ")"
                + ")";
        
        // Tabela de configurações
        String CREATE_SETTINGS_TABLE = "CREATE TABLE " + TABLE_SETTINGS + "("
                + COL_SETTING_KEY + " TEXT PRIMARY KEY,"
                + COL_SETTING_VALUE + " TEXT NOT NULL,"
                + COL_SETTING_UPDATED + " DATETIME DEFAULT CURRENT_TIMESTAMP"
                + ")";
        
        // Tabela de fila de sincronização
        String CREATE_SYNC_QUEUE_TABLE = "CREATE TABLE " + TABLE_SYNC_QUEUE + "("
                + COL_SYNC_ID + " INTEGER PRIMARY KEY AUTOINCREMENT,"
                + COL_SYNC_TABLE + " TEXT NOT NULL,"
                + COL_SYNC_ACTION + " TEXT NOT NULL,"
                + COL_SYNC_DATA + " TEXT NOT NULL,"
                + COL_SYNC_CREATED + " DATETIME DEFAULT CURRENT_TIMESTAMP"
                + ")";
        
        db.execSQL(CREATE_MACHINES_TABLE);
        db.execSQL(CREATE_OPERATIONS_TABLE);
        db.execSQL(CREATE_SETTINGS_TABLE);
        db.execSQL(CREATE_SYNC_QUEUE_TABLE);
        
        // Inserir máquinas padrão
        insertDefaultMachines(db);
        
        // Inserir configurações padrão
        insertDefaultSettings(db);
        
        Log.d(TAG, "Banco de dados criado com sucesso");
    }
    
    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        Log.d(TAG, "Atualizando banco de dados de " + oldVersion + " para " + newVersion);
        // Implementar migração se necessário
    }
    
    private void insertDefaultMachines(SQLiteDatabase db) {
        Log.d(TAG, "Inserindo máquinas padrão...");
        
        // Máquinas de lavar
        insertMachine(db, "Lavadora 1", "LAVAR", 15.00, 30);
        insertMachine(db, "Lavadora 2", "LAVAR", 15.00, 30);
        insertMachine(db, "Lavadora 3", "LAVAR", 15.00, 30);
        
        // Máquinas de secar
        insertMachine(db, "Secadora 1", "SECAR", 10.00, 20);
        insertMachine(db, "Secadora 2", "SECAR", 10.00, 20);
        insertMachine(db, "Secadora 3", "SECAR", 10.00, 20);
        
        Log.d(TAG, "Máquinas padrão inseridas");
    }
    
    private void insertMachine(SQLiteDatabase db, String name, String type, double price, int duration) {
        ContentValues values = new ContentValues();
        values.put(COL_MACHINE_NAME, name);
        values.put(COL_MACHINE_TYPE, type);
        values.put(COL_MACHINE_STATUS, "LIVRE");
        values.put(COL_MACHINE_PRICE, price);
        values.put(COL_MACHINE_DURATION, duration);
        db.insert(TABLE_MACHINES, null, values);
    }
    
    private void insertDefaultSettings(SQLiteDatabase db) {
        Log.d(TAG, "Inserindo configurações padrão...");
        
        insertSetting(db, "company_name", "Top Lavanderia");
        insertSetting(db, "company_address", "Rua das Lavadeiras, 123");
        insertSetting(db, "company_phone", "(11) 99999-9999");
        insertSetting(db, "sync_enabled", "true");
        insertSetting(db, "sync_url", "https://api.toplavanderia.com");
        insertSetting(db, "offline_mode", "true");
        insertSetting(db, "auto_sync", "true");
        insertSetting(db, "sync_interval", "300"); // 5 minutos
        
        Log.d(TAG, "Configurações padrão inseridas");
    }
    
    private void insertSetting(SQLiteDatabase db, String key, String value) {
        ContentValues values = new ContentValues();
        values.put(COL_SETTING_KEY, key);
        values.put(COL_SETTING_VALUE, value);
        db.insert(TABLE_SETTINGS, null, values);
    }
    
    // ===== MÉTODOS PARA MÁQUINAS =====
    
    public List<Machine> getAllMachines() {
        List<Machine> machines = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();
        
        String selectQuery = "SELECT * FROM " + TABLE_MACHINES + " ORDER BY " + COL_MACHINE_TYPE + ", " + COL_MACHINE_NAME;
        Cursor cursor = db.rawQuery(selectQuery, null);
        
        if (cursor.moveToFirst()) {
            do {
                Machine machine = new Machine();
                machine.setId(cursor.getInt(cursor.getColumnIndexOrThrow(COL_MACHINE_ID)));
                machine.setName(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_NAME)));
                machine.setType(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_TYPE)));
                machine.setStatus(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_STATUS)));
                machine.setPrice(cursor.getDouble(cursor.getColumnIndexOrThrow(COL_MACHINE_PRICE)));
                machine.setDuration(cursor.getInt(cursor.getColumnIndexOrThrow(COL_MACHINE_DURATION)));
                machine.setCreatedAt(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_CREATED)));
                machine.setUpdatedAt(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_UPDATED)));
                
                machines.add(machine);
            } while (cursor.moveToNext());
        }
        
        cursor.close();
        db.close();
        return machines;
    }
    
    public List<Machine> getMachinesByType(String type) {
        List<Machine> machines = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();
        
        String selectQuery = "SELECT * FROM " + TABLE_MACHINES + " WHERE " + COL_MACHINE_TYPE + " = ? ORDER BY " + COL_MACHINE_NAME;
        Cursor cursor = db.rawQuery(selectQuery, new String[]{type});
        
        if (cursor.moveToFirst()) {
            do {
                Machine machine = new Machine();
                machine.setId(cursor.getInt(cursor.getColumnIndexOrThrow(COL_MACHINE_ID)));
                machine.setName(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_NAME)));
                machine.setType(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_TYPE)));
                machine.setStatus(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_STATUS)));
                machine.setPrice(cursor.getDouble(cursor.getColumnIndexOrThrow(COL_MACHINE_PRICE)));
                machine.setDuration(cursor.getInt(cursor.getColumnIndexOrThrow(COL_MACHINE_DURATION)));
                machine.setCreatedAt(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_CREATED)));
                machine.setUpdatedAt(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_UPDATED)));
                
                machines.add(machine);
            } while (cursor.moveToNext());
        }
        
        cursor.close();
        db.close();
        return machines;
    }
    
    public Machine getMachineById(int id) {
        SQLiteDatabase db = this.getReadableDatabase();
        
        String selectQuery = "SELECT * FROM " + TABLE_MACHINES + " WHERE " + COL_MACHINE_ID + " = ?";
        Cursor cursor = db.rawQuery(selectQuery, new String[]{String.valueOf(id)});
        
        Machine machine = null;
        if (cursor.moveToFirst()) {
            machine = new Machine();
            machine.setId(cursor.getInt(cursor.getColumnIndexOrThrow(COL_MACHINE_ID)));
            machine.setName(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_NAME)));
            machine.setType(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_TYPE)));
            machine.setStatus(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_STATUS)));
            machine.setPrice(cursor.getDouble(cursor.getColumnIndexOrThrow(COL_MACHINE_PRICE)));
            machine.setDuration(cursor.getInt(cursor.getColumnIndexOrThrow(COL_MACHINE_DURATION)));
            machine.setCreatedAt(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_CREATED)));
            machine.setUpdatedAt(cursor.getString(cursor.getColumnIndexOrThrow(COL_MACHINE_UPDATED)));
        }
        
        cursor.close();
        db.close();
        return machine;
    }
    
    public boolean updateMachineStatus(int machineId, String status) {
        SQLiteDatabase db = this.getWritableDatabase();
        
        ContentValues values = new ContentValues();
        values.put(COL_MACHINE_STATUS, status);
        values.put(COL_MACHINE_UPDATED, getCurrentDateTime());
        
        int result = db.update(TABLE_MACHINES, values, COL_MACHINE_ID + " = ?", new String[]{String.valueOf(machineId)});
        db.close();
        
        return result > 0;
    }
    
    // ===== MÉTODOS PARA OPERAÇÕES =====
    
    public long createOperation(int machineId, String service, double price) {
        SQLiteDatabase db = this.getWritableDatabase();
        
        ContentValues values = new ContentValues();
        values.put(COL_OPERATION_MACHINE_ID, machineId);
        values.put(COL_OPERATION_SERVICE, service);
        values.put(COL_OPERATION_PRICE, price);
        values.put(COL_OPERATION_STATUS, "PENDENTE");
        values.put(COL_OPERATION_CREATED, getCurrentDateTime());
        values.put(COL_OPERATION_SYNCED, 0);
        
        long operationId = db.insert(TABLE_OPERATIONS, null, values);
        db.close();
        
        Log.d(TAG, "Operação criada: ID " + operationId);
        return operationId;
    }
    
    public boolean updateOperationPayment(long operationId, String paymentCode, String transactionId) {
        SQLiteDatabase db = this.getWritableDatabase();
        
        ContentValues values = new ContentValues();
        values.put(COL_OPERATION_PAYMENT_CODE, paymentCode);
        values.put(COL_OPERATION_TRANSACTION_ID, transactionId);
        values.put(COL_OPERATION_STATUS, "PAGO");
        values.put(COL_OPERATION_START_TIME, getCurrentDateTime());
        
        int result = db.update(TABLE_OPERATIONS, values, COL_OPERATION_ID + " = ?", new String[]{String.valueOf(operationId)});
        db.close();
        
        return result > 0;
    }
    
    public boolean finishOperation(long operationId) {
        SQLiteDatabase db = this.getWritableDatabase();
        
        ContentValues values = new ContentValues();
        values.put(COL_OPERATION_STATUS, "FINALIZADO");
        values.put(COL_OPERATION_END_TIME, getCurrentDateTime());
        
        int result = db.update(TABLE_OPERATIONS, values, COL_OPERATION_ID + " = ?", new String[]{String.valueOf(operationId)});
        db.close();
        
        return result > 0;
    }
    
    public List<Operation> getOperationsByDate(String date) {
        List<Operation> operations = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();
        
        String selectQuery = "SELECT o.*, m." + COL_MACHINE_NAME + " as machine_name " +
                           "FROM " + TABLE_OPERATIONS + " o " +
                           "JOIN " + TABLE_MACHINES + " m ON o." + COL_OPERATION_MACHINE_ID + " = m." + COL_MACHINE_ID + " " +
                           "WHERE DATE(o." + COL_OPERATION_CREATED + ") = ? " +
                           "ORDER BY o." + COL_OPERATION_CREATED + " DESC";
        
        Cursor cursor = db.rawQuery(selectQuery, new String[]{date});
        
        if (cursor.moveToFirst()) {
            do {
                Operation operation = new Operation();
                operation.setId(cursor.getLong(cursor.getColumnIndexOrThrow(COL_OPERATION_ID)));
                operation.setMachineId(cursor.getInt(cursor.getColumnIndexOrThrow(COL_OPERATION_MACHINE_ID)));
                operation.setMachineName(cursor.getString(cursor.getColumnIndexOrThrow("machine_name")));
                operation.setService(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_SERVICE)));
                operation.setPrice(cursor.getDouble(cursor.getColumnIndexOrThrow(COL_OPERATION_PRICE)));
                operation.setStatus(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_STATUS)));
                operation.setPaymentCode(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_PAYMENT_CODE)));
                operation.setTransactionId(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_TRANSACTION_ID)));
                operation.setStartTime(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_START_TIME)));
                operation.setEndTime(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_END_TIME)));
                operation.setCreatedAt(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_CREATED)));
                operation.setSynced(cursor.getInt(cursor.getColumnIndexOrThrow(COL_OPERATION_SYNCED)) == 1);
                
                operations.add(operation);
            } while (cursor.moveToNext());
        }
        
        cursor.close();
        db.close();
        return operations;
    }
    
    public List<Operation> getUnsyncedOperations() {
        List<Operation> operations = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();
        
        String selectQuery = "SELECT o.*, m." + COL_MACHINE_NAME + " as machine_name " +
                           "FROM " + TABLE_OPERATIONS + " o " +
                           "JOIN " + TABLE_MACHINES + " m ON o." + COL_OPERATION_MACHINE_ID + " = m." + COL_MACHINE_ID + " " +
                           "WHERE o." + COL_OPERATION_SYNCED + " = 0 " +
                           "ORDER BY o." + COL_OPERATION_CREATED + " ASC";
        
        Cursor cursor = db.rawQuery(selectQuery, null);
        
        if (cursor.moveToFirst()) {
            do {
                Operation operation = new Operation();
                operation.setId(cursor.getLong(cursor.getColumnIndexOrThrow(COL_OPERATION_ID)));
                operation.setMachineId(cursor.getInt(cursor.getColumnIndexOrThrow(COL_OPERATION_MACHINE_ID)));
                operation.setMachineName(cursor.getString(cursor.getColumnIndexOrThrow("machine_name")));
                operation.setService(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_SERVICE)));
                operation.setPrice(cursor.getDouble(cursor.getColumnIndexOrThrow(COL_OPERATION_PRICE)));
                operation.setStatus(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_STATUS)));
                operation.setPaymentCode(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_PAYMENT_CODE)));
                operation.setTransactionId(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_TRANSACTION_ID)));
                operation.setStartTime(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_START_TIME)));
                operation.setEndTime(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_END_TIME)));
                operation.setCreatedAt(cursor.getString(cursor.getColumnIndexOrThrow(COL_OPERATION_CREATED)));
                operation.setSynced(cursor.getInt(cursor.getColumnIndexOrThrow(COL_OPERATION_SYNCED)) == 1);
                
                operations.add(operation);
            } while (cursor.moveToNext());
        }
        
        cursor.close();
        db.close();
        return operations;
    }
    
    // ===== MÉTODOS PARA CONFIGURAÇÕES =====
    
    public String getSetting(String key) {
        SQLiteDatabase db = this.getReadableDatabase();
        
        String selectQuery = "SELECT " + COL_SETTING_VALUE + " FROM " + TABLE_SETTINGS + " WHERE " + COL_SETTING_KEY + " = ?";
        Cursor cursor = db.rawQuery(selectQuery, new String[]{key});
        
        String value = null;
        if (cursor.moveToFirst()) {
            value = cursor.getString(cursor.getColumnIndexOrThrow(COL_SETTING_VALUE));
        }
        
        cursor.close();
        db.close();
        return value;
    }
    
    public boolean setSetting(String key, String value) {
        SQLiteDatabase db = this.getWritableDatabase();
        
        ContentValues values = new ContentValues();
        values.put(COL_SETTING_KEY, key);
        values.put(COL_SETTING_VALUE, value);
        values.put(COL_SETTING_UPDATED, getCurrentDateTime());
        
        long result = db.insertWithOnConflict(TABLE_SETTINGS, null, values, SQLiteDatabase.CONFLICT_REPLACE);
        db.close();
        
        return result != -1;
    }
    
    // ===== MÉTODOS PARA SINCRONIZAÇÃO =====
    
    public void addToSyncQueue(String table, String action, String data) {
        SQLiteDatabase db = this.getWritableDatabase();
        
        ContentValues values = new ContentValues();
        values.put(COL_SYNC_TABLE, table);
        values.put(COL_SYNC_ACTION, action);
        values.put(COL_SYNC_DATA, data);
        values.put(COL_SYNC_CREATED, getCurrentDateTime());
        
        db.insert(TABLE_SYNC_QUEUE, null, values);
        db.close();
        
        Log.d(TAG, "Adicionado à fila de sincronização: " + table + " - " + action);
    }
    
    public List<SyncItem> getSyncQueue() {
        List<SyncItem> syncItems = new ArrayList<>();
        SQLiteDatabase db = this.getReadableDatabase();
        
        String selectQuery = "SELECT * FROM " + TABLE_SYNC_QUEUE + " ORDER BY " + COL_SYNC_CREATED + " ASC";
        Cursor cursor = db.rawQuery(selectQuery, null);
        
        if (cursor.moveToFirst()) {
            do {
                SyncItem item = new SyncItem();
                item.setId(cursor.getLong(cursor.getColumnIndexOrThrow(COL_SYNC_ID)));
                item.setTable(cursor.getString(cursor.getColumnIndexOrThrow(COL_SYNC_TABLE)));
                item.setAction(cursor.getString(cursor.getColumnIndexOrThrow(COL_SYNC_ACTION)));
                item.setData(cursor.getString(cursor.getColumnIndexOrThrow(COL_SYNC_DATA)));
                item.setCreatedAt(cursor.getString(cursor.getColumnIndexOrThrow(COL_SYNC_CREATED)));
                
                syncItems.add(item);
            } while (cursor.moveToNext());
        }
        
        cursor.close();
        db.close();
        return syncItems;
    }
    
    public boolean markOperationAsSynced(long operationId) {
        SQLiteDatabase db = this.getWritableDatabase();
        
        ContentValues values = new ContentValues();
        values.put(COL_OPERATION_SYNCED, 1);
        
        int result = db.update(TABLE_OPERATIONS, values, COL_OPERATION_ID + " = ?", new String[]{String.valueOf(operationId)});
        db.close();
        
        return result > 0;
    }
    
    public void clearSyncQueue() {
        SQLiteDatabase db = this.getWritableDatabase();
        db.delete(TABLE_SYNC_QUEUE, null, null);
        db.close();
        
        Log.d(TAG, "Fila de sincronização limpa");
    }
    
    // ===== MÉTODOS AUXILIARES =====
    
    private String getCurrentDateTime() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
        return sdf.format(new Date());
    }
    
    // ===== CLASSES DE DADOS =====
    
    public static class Machine {
        private int id;
        private String name;
        private String type;
        private String status;
        private double price;
        private int duration;
        private String createdAt;
        private String updatedAt;
        
        // Getters e Setters
        public int getId() { return id; }
        public void setId(int id) { this.id = id; }
        
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        
        public double getPrice() { return price; }
        public void setPrice(double price) { this.price = price; }
        
        public int getDuration() { return duration; }
        public void setDuration(int duration) { this.duration = duration; }
        
        public String getCreatedAt() { return createdAt; }
        public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
        
        public String getUpdatedAt() { return updatedAt; }
        public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
        
        public boolean isAvailable() {
            return "LIVRE".equals(status);
        }
        
        public String getStatusDisplay() {
            switch (status) {
                case "LIVRE": return "🟢 Livre";
                case "OCUPADA": return "🔴 Ocupada";
                case "MANUTENCAO": return "🟡 Manutenção";
                default: return "❓ Desconhecido";
            }
        }
        
        public String getTypeDisplay() {
            switch (type) {
                case "LAVAR": return "🧺 Lavar";
                case "SECAR": return "🌪️ Secar";
                default: return "❓ Desconhecido";
            }
        }
    }
    
    public static class Operation {
        private long id;
        private int machineId;
        private String machineName;
        private String service;
        private double price;
        private String status;
        private String paymentCode;
        private String transactionId;
        private String startTime;
        private String endTime;
        private String createdAt;
        private boolean synced;
        
        // Getters e Setters
        public long getId() { return id; }
        public void setId(long id) { this.id = id; }
        
        public int getMachineId() { return machineId; }
        public void setMachineId(int machineId) { this.machineId = machineId; }
        
        public String getMachineName() { return machineName; }
        public void setMachineName(String machineName) { this.machineName = machineName; }
        
        public String getService() { return service; }
        public void setService(String service) { this.service = service; }
        
        public double getPrice() { return price; }
        public void setPrice(double price) { this.price = price; }
        
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        
        public String getPaymentCode() { return paymentCode; }
        public void setPaymentCode(String paymentCode) { this.paymentCode = paymentCode; }
        
        public String getTransactionId() { return transactionId; }
        public void setTransactionId(String transactionId) { this.transactionId = transactionId; }
        
        public String getStartTime() { return startTime; }
        public void setStartTime(String startTime) { this.startTime = startTime; }
        
        public String getEndTime() { return endTime; }
        public void setEndTime(String endTime) { this.endTime = endTime; }
        
        public String getCreatedAt() { return createdAt; }
        public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
        
        public boolean isSynced() { return synced; }
        public void setSynced(boolean synced) { this.synced = synced; }
        
        public String getStatusDisplay() {
            switch (status) {
                case "PENDENTE": return "⏳ Pendente";
                case "PAGO": return "✅ Pago";
                case "CANCELADO": return "❌ Cancelado";
                case "FINALIZADO": return "🏁 Finalizado";
                default: return "❓ Desconhecido";
            }
        }
    }
    
    public static class SyncItem {
        private long id;
        private String table;
        private String action;
        private String data;
        private String createdAt;
        
        // Getters e Setters
        public long getId() { return id; }
        public void setId(long id) { this.id = id; }
        
        public String getTable() { return table; }
        public void setTable(String table) { this.table = table; }
        
        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }
        
        public String getData() { return data; }
        public void setData(String data) { this.data = data; }
        
        public String getCreatedAt() { return createdAt; }
        public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
    }
}
