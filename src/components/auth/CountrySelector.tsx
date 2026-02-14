import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { COUNTRIES } from '@/data/countries';

interface CountrySelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CountrySelector({ value, onChange, className }: CountrySelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedCountry = useMemo(
    () => COUNTRIES.find((c) => c.code === value),
    [value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full h-12 justify-between rounded-xl bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {selectedCountry ? (
            <span>
              {selectedCountry.flag} {selectedCountry.name}
            </span>
          ) : (
            '국가를 선택하세요'
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="국가 검색..." />
          <CommandList>
            <CommandEmpty>검색 결과가 없습니다</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.nameKo}`}
                  onSelect={() => {
                    onChange(country.code);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === country.code ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {country.flag} {country.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
