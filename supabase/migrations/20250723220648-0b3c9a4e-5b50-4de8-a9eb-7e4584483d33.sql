-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'operator', 'user')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create machines table
CREATE TABLE public.machines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('washing', 'drying')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'offline')),
  price_per_kg DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  capacity_kg INTEGER NOT NULL DEFAULT 10,
  location TEXT,
  temperature INTEGER DEFAULT 0,
  last_maintenance TIMESTAMP WITH TIME ZONE,
  total_uses INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on machines
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

-- Create policies for machines (readable by all authenticated users)
CREATE POLICY "Authenticated users can view machines" 
ON public.machines 
FOR SELECT 
TO authenticated
USING (true);

-- Only admins can modify machines
CREATE POLICY "Only admins can modify machines" 
ON public.machines 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create transactions table for machine usage
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  weight_kg DECIMAL(5,2),
  duration_minutes INTEGER,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('credit', 'pix', 'card', 'cash')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for transactions
CREATE POLICY "Users can view their own transactions" 
ON public.transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions" 
ON public.transactions 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'operator')
  )
);

CREATE POLICY "Users can create transactions" 
ON public.transactions 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can modify transactions" 
ON public.transactions 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'operator')
  )
);

-- Create user credits table
CREATE TABLE public.user_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('added', 'used', 'refund')),
  transaction_id UUID REFERENCES public.transactions(id),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user credits
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Create policies for user credits
CREATE POLICY "Users can view their own credits" 
ON public.user_credits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all credits" 
ON public.user_credits 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'operator')
  )
);

CREATE POLICY "Only admins can manage credits" 
ON public.user_credits 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'operator')
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_machines_updated_at
  BEFORE UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email),
    'user'
  );
  RETURN new;
END;
$$;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert some sample machines
INSERT INTO public.machines (name, type, status, price_per_kg, capacity_kg, location, total_uses, total_revenue) VALUES
('Lavadora 01', 'washing', 'available', 5.00, 10, 'Andar Térreo', 45, 2250.00),
('Lavadora 02', 'washing', 'in_use', 5.00, 10, 'Andar Térreo', 38, 1900.00),
('Lavadora 03', 'washing', 'maintenance', 5.00, 10, 'Andar Térreo', 42, 2100.00),
('Secadora 01', 'drying', 'available', 4.00, 8, 'Andar Térreo', 32, 1280.00),
('Secadora 02', 'drying', 'available', 4.00, 8, 'Andar Térreo', 28, 1120.00),
('Lavadora 04', 'washing', 'available', 5.00, 12, '1º Andar', 25, 1250.00);