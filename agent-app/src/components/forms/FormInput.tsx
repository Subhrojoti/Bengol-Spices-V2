import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import type { ComponentProps } from "react";

interface FormInputProps<T extends FieldValues> extends Omit<ComponentProps<typeof Input>, "value" | "onChangeText"> {
  control: Control<T>;
  name: Path<T>;
}

export function FormInput<T extends FieldValues>({ control, name, ...rest }: FormInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <Input value={value != null ? String(value) : ""} onChangeText={onChange} onBlur={onBlur} error={error?.message} {...rest} />
      )}
    />
  );
}
