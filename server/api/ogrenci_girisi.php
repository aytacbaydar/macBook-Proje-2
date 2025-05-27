<?php
// server/api/ogrenci_kayit.php
require_once '../../config.php';
?>
```

```php
<?php
// server/api/ogrenci_giris.php
require_once '../../config.php';
?>
```

```php
<?php
// index.php
require_once 'server/api/ogrenci_kayit.php';
require_once 'server/api/ogrenci_giris.php';
?>
```

```php
<?php
// config.php
define('DB_HOST', 'localhost');
define('DB_USER', 'user');
define('DB_PASS', 'password');
define('DB_NAME', 'database');
?>